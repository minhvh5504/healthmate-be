import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../notifications/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleOAuthDto } from './dto/google-oauth.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Role, VerificationType } from '@prisma/client';
import { ResponseHelper } from '../../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../../common/constants/message-codes.const';
import { ApiException } from '../../../common/exceptions/api.exception';
import type { StringValue } from 'ms';
import { MockSmsService } from '../../notifications/sms.service';
import { GoogleOAuthService } from './services/google-oauth.service';

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
  ) { }

  /**
   * Generate 6-digit OTP code
   */
  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Create verification code record
   */
  private async createVerificationCode(
    userId: string,
    type: VerificationType,
  ): Promise<string> {
    const code = this.generateOtpCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // Expires in 5 minutes

    await this.prisma.verificationCode.create({
      data: {
        userId,
        code,
        type,
        expiresAt,
      },
    });

    return code;
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokenPair(
    userId: string,
    email: string | null,
  ): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, email };

    // Generate access token
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>(
        'JWT_EXPIRES_IN',
        '7d',
      ) as StringValue,
    });

    // Generate refresh token
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
        '30d',
      ) as StringValue,
    });

    // Calculate expiration date for refresh token (30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

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
        'AUTH.REGISTER.EMAIL_EXISTS',
        'Email already registered',
        409,
        'Register failed',
      );
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user with emailVerified = false
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName: this.generateDefaultFullName(),
        role: Role.USER,
        emailVerified: false,
        isActive: true,
      },
    });

    // Generate OTP code
    const otpCode = await this.createVerificationCode(
      user.id,
      VerificationType.EMAIL_VERIFICATION,
    );

    // Send OTP via email
    await this.mailService.sendOtpEmail(email, otpCode);

    return ResponseHelper.success(
      { email },
      MessageCodes.REGISTER_SUCCESS,
      'Register successfully! Please check your email to verify your account.',
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
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'Verification failed',
      );
    }

    if (!user.isActive) {
      throw new ApiException(
        MessageCodes.ACCOUNT_DISABLED,
        'Your account has been deactivated/blocked by admin',
        401,
        'Verification failed',
      );
    }

    // Mapping external type to internal VerificationType
    const verificationType =
      type === 'forgotpassword'
        ? VerificationType.PASSWORD_RESET
        : VerificationType.EMAIL_VERIFICATION;

    // Find verification code
    const verificationCode = await this.prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        code,
        type: verificationType,
        isUsed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verificationCode) {
      throw new ApiException(
        MessageCodes.INVALID_OTP,
        'Invalid verification code',
        400,
        'Verification failed',
      );
    }

    // Check if code is expired
    if (new Date() > verificationCode.expiresAt) {
      throw new ApiException(
        MessageCodes.OTP_EXPIRED,
        'Verification code has expired',
        400,
        'Verification failed',
      );
    }

    if (type === 'account') {
      await this.prisma.$transaction([
        this.prisma.verificationCode.update({
          where: { id: verificationCode.id },
          data: { isUsed: true },
        }),
        this.prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        }),
      ]);

      // Send welcome email
      if (user.email) {
        await this.mailService.sendWelcomeEmail(user.email, user.fullName);
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
        'Email verified successfully!',
        200,
      );
    }

    // Mark OTP as used immediately
    await this.prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: { isUsed: true },
    });

    // Generate a temporary reset token (expires in 15 minutes)
    const resetToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        type: 'RESET_PASSWORD',
        p: user.password
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '15m',
      },
    );

    return ResponseHelper.success(
      { email, resetToken },
      MessageCodes.VERIFY_SUCCESS,
      'OTP verified successfully! You can now reset your password.',
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
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'Resend OTP failed',
      );
    }

    // Mapping external type to internal VerificationType
    const verificationType =
      type === 'forgotpassword'
        ? VerificationType.PASSWORD_RESET
        : VerificationType.EMAIL_VERIFICATION;

    if (type === 'account' && user.emailVerified) {
      throw new ApiException(
        'AUTH.VERIFY.ALREADY_VERIFIED',
        'Email already verified',
        400,
        'Resend OTP failed',
      );
    }

    // Generate new OTP code
    const otpCode = await this.createVerificationCode(
      user.id,
      verificationType,
    );

    // Send OTP via email
    if (type === 'forgotpassword') {
      await this.mailService.sendForgotPasswordEmail(
        email,
        user.fullName,
        otpCode,
      );
    } else {
      await this.mailService.sendOtpEmail(email, otpCode);
    }

    return ResponseHelper.success(
      { email },
      'AUTH.RESEND_OTP.SUCCESS',
      'OTP code has been resent to your email!',
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
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.INVALID_CREDENTIALS,
        'Email or password is incorrect',
        401,
        'Login failed',
      );
    }

    // Check if account is active (not blocked by admin)
    if (!user.isActive) {
      if (user.failedLoginAttempts && user.failedLoginAttempts >= 5) {
        throw new ApiException(
          MessageCodes.ACCOUNT_DISABLED,
          'Your account has been locked due to too many failed login attempts. Please contact admin to unlock',
          401,
          'Login failed',
        );
      }
      throw new ApiException(
        MessageCodes.ACCOUNT_DISABLED,
        'Your account has been deactivated/blocked by admin',
        401,
        'Login failed',
      );
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new ApiException(
        MessageCodes.ACCOUNT_NOT_VERIFIED,
        'Please verify your email address first',
        401,
        'Login failed',
      );
    }

    // Check if user has password (OAuth users don't have password)
    if (!user.password) {
      throw new ApiException(
        MessageCodes.INVALID_CREDENTIALS,
        'This account was registered via OAuth. Please log in with Google.',
        401,
        'Login failed',
      );
    }

    // Verify password
    const isPasswordValid = await this.comparePasswords(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;

      if (failedAttempts >= 5) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: failedAttempts, isActive: false },
        });
        throw new ApiException(
          MessageCodes.ACCOUNT_DISABLED,
          'Your account has been locked due to too many failed login attempts. Please contact admin to unlock',
          401,
          'Login failed',
        );
      } else {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: failedAttempts },
        });
        throw new ApiException(
          MessageCodes.INVALID_CREDENTIALS,
          'Phone number/email or password is incorrect',
          401,
          'Login failed',
        );
      }
    }

    // Reset failedLoginAttempts on successful login
    if (user.failedLoginAttempts && user.failedLoginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0 },
      });
    }

    // Generate tokens
    const tokens = await this.generateTokenPair(
      user.id,
      user.email,
    );

    // Remove password from response
    const { password: _password, ...userWithoutPassword } = user;

    return ResponseHelper.success(
      {
        user: userWithoutPassword,
        ...tokens,
      },
      MessageCodes.LOGIN_SUCCESS,
      'Login successfully!',
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
            picture: googleUser.picture,
          },
        });
      }
    } else {
      // User doesn't exist - register
      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          fullName: this.generateDefaultFullName(),
          googleId: googleUser.googleId,
          picture: googleUser.picture,
          emailVerified: true,
          role: Role.USER,
          isActive: true,
        },
      });
    }

    // Check if account is active (not blocked by admin)
    if (!user.isActive) {
      throw new ApiException(
        MessageCodes.ACCOUNT_DISABLED,
        'Your account has been deactivated/blocked by admin',
        401,
        'Login failed',
      );
    }

    // Generate tokens
    const tokens = await this.generateTokenPair(
      user.id,
      user.email,
    );

    // Remove password from response
    const { password: _password, ...userWithoutPassword } = user;

    return ResponseHelper.success(
      {
        user: userWithoutPassword,
        ...tokens,
      },
      MessageCodes.LOGIN_SUCCESS,
      'Login with Google successfully!',
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
          'Invalid refresh token',
          401,
          'Token refresh failed',
        );
      }

      // Check if user is active
      if (!storedToken.user.isActive) {
        throw new ApiException(
          MessageCodes.ACCOUNT_DISABLED,
          'Your account has been deactivated/blocked by admin',
          401,
          'Token refresh failed',
        );
      }

      // Check if token is expired
      if (new Date() > storedToken.expiresAt) {
        throw new ApiException(
          MessageCodes.REFRESH_TOKEN_EXPIRED,
          'Refresh token has expired',
          401,
          'Token refresh failed',
        );
      }

      // Generate new token pair
      const tokens = await this.generateTokenPair(
        payload.sub,
        payload.email,
      );

      // Revoke old refresh token
      await this.prisma.refreshToken.update({
        where: { token: refreshToken },
        data: { isRevoked: true },
      });

      return ResponseHelper.success(
        tokens,
        MessageCodes.REFRESH_SUCCESS,
        'Token refreshed successfully',
        200,
      );
    } catch {
      throw new ApiException(
        MessageCodes.INVALID_REFRESH_TOKEN,
        'Invalid or expired refresh token',
        401,
        'Token refresh failed',
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
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User with this email does not exist!',
        404,
        'Forgot password failed',
      );
    }

    if (!user.isActive) {
      throw new ApiException(
        MessageCodes.ACCOUNT_DISABLED,
        'Your account has been deactivated/blocked by admin',
        401,
        'Forgot password failed',
      );
    }

    // Generate and store reset code
    const code = await this.createVerificationCode(
      user.id,
      VerificationType.PASSWORD_RESET,
    );

    // Send email
    await this.mailService.sendForgotPasswordEmail(
      email,
      user.fullName,
      code,
    );

    return ResponseHelper.success(
      { email },
      MessageCodes.FORGOT_PASSWORD_SUCCESS,
      'Otp reset password has been sent to email!',
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
        throw new Error('Invalid token type');
      }
    } catch (error) {
      throw new ApiException(
        MessageCodes.INVALID_TOKEN,
        'Invalid or expired reset token',
        400,
        'Reset password failed',
      );
    }

    const userId = payload.sub;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'Reset password failed',
      );
    }

    if (!user.isActive) {
      throw new ApiException(
        MessageCodes.ACCOUNT_DISABLED,
        'Your account has been deactivated/blocked by admin',
        401,
        'Reset password failed',
      );
    }

    const oldPasswordHash = payload.p;
    if (oldPasswordHash) {
      const isSamePassword = await this.comparePasswords(newPassword, oldPasswordHash);
      if (isSamePassword) {
        throw new ApiException(
          MessageCodes.SAME_PASSWORD,
          'New password cannot be the same as the old password. Please choose a different password.',
          400,
          'Reset password failed',
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
      'Password has been reset successfully!',
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
      'Logged out successfully',
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
        fullName: true,
        role: true,
        avatar: true,
        dateOfBirth: true,
        gender: true,
        address: true,
        emailVerified: true,
        googleId: true,
        picture: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    return user;
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string) {
    const user = await this.validateUser(userId);

    return ResponseHelper.success(
      user,
      MessageCodes.PROFILE_RETRIEVED,
      'Profile retrieved successfully',
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
  private async comparePasswords(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
