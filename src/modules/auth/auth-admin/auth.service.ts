import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../notifications/mail.service';
import { AdminLoginDto } from './dto/login.dto';
import { AdminRegisterDto } from './dto/register.dto';
import { AdminRefreshTokenDto } from './dto/refresh-token.dto';
import { AdminVerifyEmailDto } from './dto/verify-email.dto';
import { AdminResendOtpDto } from './dto/resend-otp.dto';
import { Role, VerificationType } from '@prisma/client';
import { ResponseHelper } from '../../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../../common/constants/message-codes.const';
import { ApiException } from '../../../common/exceptions/api.exception';
import type { StringValue } from 'ms';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface JwtPayload {
  sub: string;
  email: string | null;
  role: Role;
}

@Injectable()
export class AuthAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
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
    role: Role,
  ): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, email, role };

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
   * Generate default fullName like Admin.123456
   */
  private generateDefaultFullName(): string {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `Admin.${randomNum}`;
  }

  /**
   * Register a new admin with email
   */
  async register(registerDto: AdminRegisterDto) {
    const { email, password } = registerDto;

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ApiException(
        MessageCodes.EMAIL_ALREADY_EXISTS,
        'Email already registered',
        409,
        'Register failed',
      );
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user with emailVerified = false and Role.ADMIN
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName: this.generateDefaultFullName(),
        role: Role.ADMIN,
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
      'Admin registered successfully! Please check your email to verify your account.',
      201,
    );
  }

  /**
   * Verify account/email with OTP code
   */
  async verifyOtp(verifyOtpDto: AdminVerifyEmailDto) {
    const { email, code } = verifyOtpDto;

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

    // For admin, we only support account verification
    const verificationType = VerificationType.EMAIL_VERIFICATION;

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
    const tokens = await this.generateTokenPair(user.id, user.email, user.role);

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

  /**
   * Resend OTP code
   */
  async resendOtp(resendOtpDto: AdminResendOtpDto) {
    const { email } = resendOtpDto;

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

    const verificationType = VerificationType.EMAIL_VERIFICATION;

    if (user.emailVerified) {
      throw new ApiException(
        'AUTH.VERIFY.ALREADY_VERIFIED',
        'Email already verified',
        400,
        'Resend OTP failed',
      );
    }

    const otpCode = await this.createVerificationCode(
      user.id,
      verificationType,
    );

    await this.mailService.sendOtpEmail(email, otpCode);

    return ResponseHelper.success(
      { email },
      'AUTH.RESEND_OTP.SUCCESS',
      'OTP code has been resent to your email!',
      200,
    );
  }

  /**
   * Login admin with email
   */
  async login(loginDto: AdminLoginDto) {
    const { email, password } = loginDto;

    // Find user by email and check if it's an admin
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

    // Check if user is an admin
    if (user.role !== Role.ADMIN) {
      throw new ApiException(
        MessageCodes.INSUFFICIENT_PERMISSIONS,
        'You do not have permission to access the admin portal',
        403,
        'Login failed',
      );
    }

    // Check if account is active
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

    // Verify password
    const isPasswordValid = await this.comparePasswords(
      password,
      user.password || '',
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
          'Email or password is incorrect',
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
      user.role,
    );

    // Remove password from response
    const { password: _password, ...userWithoutPassword } = user;

    return ResponseHelper.success(
      {
        user: userWithoutPassword,
        ...tokens,
      },
      MessageCodes.LOGIN_SUCCESS,
      'Admin login successfully!',
      200,
    );
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshTokenDto: AdminRefreshTokenDto) {
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

      // Check if user is an admin
      if (storedToken.user.role !== Role.ADMIN) {
        throw new ApiException(
          MessageCodes.INSUFFICIENT_PERMISSIONS,
          'Invalid permissions',
          403,
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
        storedToken.user.role,
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
   * Validate admin (used by JWT strategy if needed)
   */
  async validateAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== Role.ADMIN || !user.isActive) {
      throw new UnauthorizedException('Unauthorized access to admin resource');
    }

    return user;
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
