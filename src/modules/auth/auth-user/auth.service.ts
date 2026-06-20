import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mails/mails.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleOAuthDto } from './dto/google-oauth.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Role /*, VerificationType */ } from '@prisma/client';
import { ResponseHelper } from '../../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../../common/constants/message-codes.const';
import { ApiException } from '../../../common/exceptions/api.exception';
import * as ms from 'ms';
import type { StringValue } from 'ms';
import { MockSmsService } from '../../mails/sms.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { RedisService, OtpType } from '../../redis/redis.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface JwtPayload {
  sub: string;
  email: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly smsService: MockSmsService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Generate 6-digit OTP code
   */
  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Create verification code record
   */
  private async createVerificationCode(userId: string, type: OtpType): Promise<string> {
    const code = this.generateOtpCode();

    await this.redisService.setOtp(userId, code, type, 300);

    return code;
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokenPair(userId: string, email: string | null): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, email };

    // Generate access token
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '7d') as StringValue,
    });

    // Generate refresh token
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d') as StringValue,
    });

    // Calculate expiration date for refresh token from config
    const refreshTokenExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d');
    const expiresAt = new Date(Date.now() + ms(refreshTokenExpiresIn as StringValue));

    // Store refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Generate default fullName like Joyer.123456
   */
  private generateDefaultFullName(): string {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `Joyer.${randomNum}`;
  }

  /**
   * Register a new user with email
   */
  async register(registerDto: RegisterDto) {
    const { email, password } = registerDto;

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ApiException(
        MessageCodes.EMAIL_ALREADY_EXISTS,
        'Email đã được đăng ký',
        409,
        'Đăng ký thất bại',
      );
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user with emailVerified = false
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        profile: {
          create: {
            fullName: this.generateDefaultFullName(),
            heightCm: 0,
            weightKg: 0,
            bmi: 0,
          },
        },
        role: Role.user,
        emailVerified: false,
        isActive: true,
      },
      include: {
        profile: true,
      },
    });

    // Generate OTP code
    const otpCode = await this.createVerificationCode(user.id, OtpType.EMAIL_VERIFICATION);

    // Send OTP via email
    await this.mailService.sendOtpEmail(email, otpCode);

    return ResponseHelper.success(
      { email },
      MessageCodes.REGISTER_SUCCESS,
      'Đăng ký thành công! Vui lòng kiểm tra email để xác minh tài khoản.',
      201,
    );
  }

  /**
   * Verify account/email/password with OTP code
   */
  async verifyOtp(verifyOtpDto: VerifyEmailDto) {
    const { email, code, type } = verifyOtpDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Không tìm thấy người dùng',
        404,
        'Xác minh thất bại',
      );
    }

    if (!user.isActive) {
      throw new ApiException(
        MessageCodes.ACCOUNT_DISABLED,
        'Tài khoản của bạn đã bị vô hiệu hóa hoặc khóa. Vui lòng liên hệ quản trị viên để mở khóa.',
        401,
        'Xác minh thất bại',
      );
    }

    // Mapping external type to OtpType
    const otpType = type === 'forgotpassword' ? OtpType.PASSWORD_RESET : OtpType.EMAIL_VERIFICATION;

    // Get code from Redis
    const storedCode = await this.redisService.getOtp(user.id, otpType);

    if (!storedCode || storedCode !== code) {
      throw new ApiException(
        MessageCodes.INVALID_OTP,
        'Mã xác minh không hợp lệ hoặc đã hết hạn',
        400,
        'Xác minh thất bại',
      );
    }

    if (type === 'account') {
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        }),
      ]);

      // Delete OTP after use
      await this.redisService.deleteOtp(user.id, otpType);

      // Send welcome email
      if (user.email) {
        await this.mailService.sendWelcomeEmail(user.email, user.profile?.fullName ?? '');
      }

      // Generate tokens
      const tokens = await this.generateTokenPair(user.id, user.email);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...userWithoutPassword } = user;

      return ResponseHelper.success(
        {
          user: { ...userWithoutPassword, emailVerified: true },
          ...tokens,
        },
        MessageCodes.VERIFY_SUCCESS,
        'Xác minh email thành công!',
        200,
      );
    }

    // Delete OTP after use
    await this.redisService.deleteOtp(user.id, otpType);

    // Generate a temporary reset token (expires in 15 minutes)
    const resetToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        type: 'RESET_PASSWORD',
        p: user.password,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '15m',
      },
    );

    return ResponseHelper.success(
      { email, resetToken },
      MessageCodes.VERIFY_SUCCESS,
      'Xác minh OTP thành công! Bạn có thể đặt lại mật khẩu.',
      200,
    );
  }

  /**
   * Resend OTP code
   */
  async resendOtp(resendOtpDto: ResendOtpDto) {
    const { email, type } = resendOtpDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Không tìm thấy người dùng',
        404,
        'Gửi lại OTP thất bại',
      );
    }

    // Mapping external type to OtpType
    const otpType = type === 'forgotpassword' ? OtpType.PASSWORD_RESET : OtpType.EMAIL_VERIFICATION;

    if (type === 'account' && user.emailVerified) {
      throw new ApiException(
        MessageCodes.ALREADY_VERIFIED,
        'Email đã được xác minh',
        400,
        'Gửi lại OTP thất bại',
      );
    }

    // Generate new OTP code store in Redis
    const otpCode = await this.createVerificationCode(user.id, otpType);

    // Send OTP via email
    if (type === 'forgotpassword') {
      await this.mailService.sendForgotPasswordEmail(email, user.profile?.fullName ?? '', otpCode);
    } else {
      await this.mailService.sendOtpEmail(email, otpCode);
    }

    return ResponseHelper.success(
      { email },
      MessageCodes.RESEND_OTP_SUCCESS,
      'Mã OTP đã được gửi lại đến email của bạn!',
      200,
    );
  }

  /**
   * Login user with email
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.prisma.user.findFirst({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.INVALID_CREDENTIALS,
        'Email hoặc mật khẩu không chính xác',
        401,
        'Đăng nhập thất bại',
      );
    }

    // 1. Check if account is active (blocked by admin or permanent lockout)
    if (!user.isActive) {
      throw new ApiException(
        MessageCodes.ACCOUNT_DISABLED,
        'Tài khoản của bạn đã bị vô hiệu hóa hoặc khóa. Vui lòng liên hệ quản trị viên để mở khóa.',
        401,
        'Đăng nhập thất bại',
      );
    }

    // 2. Check if account is locked (temporary lockout)
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (1000 * 60));
      throw new ApiException(
        MessageCodes.ACCOUNT_LOCKED,
        `Tài khoản của bạn đã bị khóa 5 phút do đăng nhập sai 5 lần. Vui lòng chờ thêm ${remainingMinutes} phút.`,
        401,
        'Đăng nhập thất bại',
      );
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new ApiException(
        MessageCodes.ACCOUNT_NOT_VERIFIED,
        'Vui lòng xác minh email trước',
        401,
        'Đăng nhập thất bại',
      );
    }

    // Check if user has password (OAuth users don't have password)
    if (!user.password) {
      throw new ApiException(
        MessageCodes.INVALID_CREDENTIALS,
        'Tài khoản này được đăng ký qua OAuth. Vui lòng đăng nhập bằng Google.',
        401,
        'Đăng nhập thất bại',
      );
    }

    // Verify password
    const isPasswordValid = await this.comparePasswords(password, user.password);

    if (!isPasswordValid) {
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;

      if (failedAttempts >= 5) {
        // Set temporary lockout for 5 minutes
        const lockedUntil = new Date(Date.now() + 5 * 60 * 1000);
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil,
          },
        });
        throw new ApiException(
          MessageCodes.ACCOUNT_LOCKED,
          'Tài khoản của bạn đã bị khóa 5 phút do đăng nhập sai 5 lần.',
          401,
          'Đăng nhập thất bại',
        );
      } else {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: failedAttempts },
        });
        throw new ApiException(
          MessageCodes.INVALID_CREDENTIALS,
          'Email hoặc mật khẩu không chính xác',
          401,
          'Đăng nhập thất bại',
        );
      }
    }

    // Reset failedLoginAttempts and lockedUntil on successful login
    if ((user.failedLoginAttempts || 0) > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    // Generate tokens
    const tokens = await this.generateTokenPair(user.id, user.email);

    // Remove password from response
    const { password: _password, ...userWithoutPassword } = user;

    return ResponseHelper.success(
      {
        user: userWithoutPassword,
        ...tokens,
      },
      MessageCodes.LOGIN_SUCCESS,
      'Đăng nhập thành công!',
      200,
    );
  }

  /**
   * Handle Google OAuth login/register
   */
  async handleGoogleOAuth(googleOAuthDto: GoogleOAuthDto) {
    const { idToken } = googleOAuthDto;

    // Verify Google ID token and get user info
    const googleUser = await this.googleOAuthService.verifyIdToken(idToken);

    // Check if user exists by googleId or email
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId: googleUser.googleId }, { email: googleUser.email }],
      },
      include: { profile: true },
    });

    if (user) {
      // User exists - login
      // Update googleId if not set
      if (!user.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: googleUser.googleId,
            emailVerified: true,
            avatarUrl: googleUser.picture,
          },
          include: { profile: true },
        });
      }
    } else {
      // User doesn't exist - register
      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          profile: {
            create: {
              fullName: googleUser.name || this.generateDefaultFullName(),
              heightCm: 0,
              weightKg: 0,
              bmi: 0,
            },
          },
          googleId: googleUser.googleId,
          avatarUrl: googleUser.picture,
          emailVerified: true,
          role: Role.user,
          isActive: true,
        },
        include: { profile: true },
      });
    }

    // Check if account is active (blocked by admin or permanent lockout)
    if (!user.isActive) {
      throw new ApiException(
        MessageCodes.ACCOUNT_DISABLED,
        'Tài khoản của bạn đã bị vô hiệu hóa hoặc khóa. Vui lòng liên hệ quản trị viên để mở khóa.',
        401,
        'Đăng nhập thất bại',
      );
    }

    // Generate tokens
    const tokens = await this.generateTokenPair(user.id, user.email);

    // Remove password from response
    const { password: _password, ...userWithoutPassword } = user;

    return ResponseHelper.success(
      {
        user: userWithoutPassword,
        ...tokens,
      },
      MessageCodes.LOGIN_SUCCESS,
      'Đăng nhập bằng Google thành công!',
      200,
    );
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    try {
      // Verify refresh token
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      // Check if refresh token exists in database and not revoked
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!storedToken || storedToken.isRevoked) {
        throw new ApiException(
          MessageCodes.INVALID_REFRESH_TOKEN,
          'Refresh token không hợp lệ',
          401,
          'Làm mới token thất bại',
        );
      }

      // Check if user is active
      if (!storedToken.user.isActive) {
        throw new ApiException(
          MessageCodes.ACCOUNT_DISABLED,
          'Tài khoản của bạn đã bị quản trị viên vô hiệu hóa hoặc khóa',
          401,
          'Làm mới token thất bại',
        );
      }

      // Check if token is expired
      if (new Date() > storedToken.expiresAt) {
        throw new ApiException(
          MessageCodes.REFRESH_TOKEN_EXPIRED,
          'Refresh token đã hết hạn',
          401,
          'Làm mới token thất bại',
        );
      }

      // Generate new token pair
      const tokens = await this.generateTokenPair(payload.sub, payload.email);

      // Revoke old refresh token
      await this.prisma.refreshToken.update({
        where: { token: refreshToken },
        data: { isRevoked: true },
      });

      return ResponseHelper.success(
        tokens,
        MessageCodes.REFRESH_SUCCESS,
        'Làm mới token thành công',
        200,
      );
    } catch {
      throw new ApiException(
        MessageCodes.INVALID_REFRESH_TOKEN,
        'Refresh token không hợp lệ hoặc đã hết hạn',
        401,
        'Làm mới token thất bại',
      );
    }
  }

  /**
   * Forgot password - send OTP email
   */
  async sendResetPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Không tồn tại người dùng với email này!',
        404,
        'Quên mật khẩu thất bại',
      );
    }

    if (!user.isActive) {
      throw new ApiException(
        MessageCodes.ACCOUNT_DISABLED,
        'Tài khoản của bạn đã bị vô hiệu hóa hoặc khóa. Vui lòng liên hệ quản trị viên để mở khóa.',
        401,
        'Quên mật khẩu thất bại',
      );
    }

    // Generate and store reset code in Redis
    const code = await this.createVerificationCode(user.id, OtpType.PASSWORD_RESET);

    // Send email
    await this.mailService.sendForgotPasswordEmail(email, user.profile?.fullName ?? '', code);

    return ResponseHelper.success(
      { email },
      MessageCodes.FORGOT_PASSWORD_SUCCESS,
      'OTP đặt lại mật khẩu đã được gửi đến email!',
      200,
    );
  }

  /**
   * Reset password with temporary reset token
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { resetToken, newPassword } = resetPasswordDto;

    let payload: any;
    try {
      // Verify the reset token
      payload = this.jwtService.verify(resetToken, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      // Check token type
      if (payload.type !== 'RESET_PASSWORD') {
        throw new Error('Loại token không hợp lệ');
      }
    } catch (error) {
      throw new ApiException(
        MessageCodes.INVALID_TOKEN,
        'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
        400,
        'Đặt lại mật khẩu thất bại',
      );
    }

    const userId = payload.sub;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Không tìm thấy người dùng',
        404,
        'Đặt lại mật khẩu thất bại',
      );
    }

    if (!user.isActive) {
      throw new ApiException(
        MessageCodes.ACCOUNT_DISABLED,
        'Tài khoản của bạn đã bị vô hiệu hóa hoặc khóa. Vui lòng liên hệ quản trị viên để mở khóa.',
        401,
        'Đặt lại mật khẩu thất bại',
      );
    }

    const oldPasswordHash = payload.p;
    if (oldPasswordHash) {
      const isSamePassword = await this.comparePasswords(newPassword, oldPasswordHash);
      if (isSamePassword) {
        throw new ApiException(
          MessageCodes.SAME_PASSWORD,
          'Mật khẩu mới không được trùng với mật khẩu cũ. Vui lòng chọn mật khẩu khác.',
          400,
          'Đặt lại mật khẩu thất bại',
        );
      }
    }

    // Hash new password
    const hashedPassword = await this.hashPassword(newPassword);

    // Update password and revoke tokens
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          emailVerified: true,
          failedLoginAttempts: 0,
        },
      }),
      // Revoke all refresh tokens for security
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      }),
    ]);

    return ResponseHelper.success(
      null,
      MessageCodes.RESET_PASSWORD_SUCCESS,
      'Đặt lại mật khẩu thành công!',
      200,
    );
  }

  /**
   * Logout - revoke refresh token
   */
  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { isRevoked: true },
    });

    return ResponseHelper.success(
      null,
      MessageCodes.LOGOUT_SUCCESS,
      'Đăng xuất thành công',
      200,
    );
  }

  /**
   * Validate user (used by JWT strategy)
   */
  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        googleId: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            fullName: true,
            dateOfBirth: true,
            gender: true,
            heightCm: true,
            weightKg: true,
            allergies: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa');
    }

    return user;
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Không tìm thấy người dùng',
        404,
        'Đổi mật khẩu thất bại',
      );
    }

    // OAuth users don't have a password
    if (!user.password) {
      throw new ApiException(
        MessageCodes.OAUTH_NO_PASSWORD,
        'Tài khoản này được đăng ký qua OAuth và không có mật khẩu. Vui lòng đăng nhập bằng Google.',
        400,
        'Đổi mật khẩu thất bại',
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await this.comparePasswords(currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      throw new ApiException(
        MessageCodes.WRONG_CURRENT_PASSWORD,
        'Mật khẩu hiện tại không chính xác',
        400,
        'Đổi mật khẩu thất bại',
      );
    }

    // New password must differ from current password
    const isSamePassword = await this.comparePasswords(newPassword, user.password);
    if (isSamePassword) {
      throw new ApiException(
        MessageCodes.SAME_PASSWORD,
        'Mật khẩu mới không được trùng với mật khẩu hiện tại. Vui lòng chọn mật khẩu khác.',
        400,
        'Đổi mật khẩu thất bại',
      );
    }

    // Hash and save new password
    const hashedPassword = await this.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return ResponseHelper.success(
      null,
      MessageCodes.CHANGE_PASSWORD_SUCCESS,
      'Đổi mật khẩu thành công!',
      200,
    );
  }

  /**
   * Hash password
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare passwords
   */
  private async comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
