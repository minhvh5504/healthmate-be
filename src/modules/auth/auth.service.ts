import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleOAuthDto } from './dto/google-oauth.dto';
import { Role, VerificationType } from '@prisma/client';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';
import type { StringValue } from 'ms';
import { MockSmsService } from './services/sms.service';
import { GoogleOAuthService } from './services/google-oauth.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface JwtPayload {
  sub: string;
  email: string | null;
  phone: string | null;
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
    phone?: string,
  ): Promise<string> {
    const code = this.generateOtpCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // Expires in 5 minutes

    await this.prisma.verificationCode.create({
      data: {
        userId,
        code,
        type,
        phone,
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
    phone: string | null,
  ): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, email, phone };

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
   * Register a new user (default role: PATIENT)
   */
  /**
   * Register a new user with phone number
   */
  async register(registerDto: RegisterDto) {
    const { phone, password, fullName } = registerDto;

    // Check if phone already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      throw new ApiException(
        'AUTH.REGISTER.PHONE_EXISTS',
        'Phone number already registered',
        409,
        'Register failed',
      );
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user with phoneVerified = false
    const user = await this.prisma.user.create({
      data: {
        phone,
        password: hashedPassword,
        fullName,
        role: Role.STAFF,
        phoneVerified: false,
        isActive: true, // Active but phone not verified
      },
    });

    // Generate OTP code
    const otpCode = await this.createVerificationCode(
      user.id,
      VerificationType.PHONE_VERIFICATION,
      phone,
    );

    // Send OTP via SMS
    await this.smsService.sendOtp(phone, otpCode);

    return ResponseHelper.success(
      { phone },
      MessageCodes.REGISTER_SUCCESS,
      'Register successfully! Please check your phone to verify the phone number.',
      201,
    );
  }

  /**
   * Verify phone with OTP code
   */
  async verifyPhone(verifyPhoneDto: VerifyPhoneDto) {
    const { phone, otp } = verifyPhoneDto;

    // Find user by phone
    const user = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'Verify phone failed',
      );
    }

    // Find verification code
    const verificationCode = await this.prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        code: otp,
        type: VerificationType.PHONE_VERIFICATION,
        phone,
        isUsed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verificationCode) {
      throw new ApiException(
        MessageCodes.INVALID_OTP,
        'Invalid OTP code',
        400,
        'Verify phone failed',
      );
    }

    // Check if code is expired
    if (new Date() > verificationCode.expiresAt) {
      throw new ApiException(
        MessageCodes.OTP_EXPIRED,
        'OTP code has expired',
        400,
        'Verify phone failed',
      );
    }

    // Mark code as used and verify phone
    await this.prisma.$transaction([
      this.prisma.verificationCode.update({
        where: { id: verificationCode.id },
        data: { isUsed: true },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { phoneVerified: true },
      }),
    ]);

    // Generate tokens
    const tokens = await this.generateTokenPair(
      user.id,
      user.email,
      user.phone,
    );

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userWithoutPassword } = user;

    return ResponseHelper.success(
      {
        user: { ...userWithoutPassword, phoneVerified: true },
        ...tokens,
      },
      MessageCodes.VERIFY_SUCCESS,
      'Verify phone successfully!',
      200,
    );
  }

  /**
   * Verify email with OTP code (kept for backward compatibility)
   */
  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { email, code } = verifyEmailDto;

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

    // Find verification code
    const verificationCode = await this.prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        code,
        type: VerificationType.EMAIL_VERIFICATION,
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

    // Mark code as used and verify email
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
    const tokens = await this.generateTokenPair(
      user.id,
      user.email,
      user.phone,
    );

    // Remove password from response
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

  /**
   * Resend OTP code
   */
  async resendOtp(resendOtpDto: ResendOtpDto) {
    const { phone } = resendOtpDto;

    const user = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'Resend OTP failed',
      );
    }

    if (user.phoneVerified) {
      throw new ApiException(
        'AUTH.VERIFY.ALREADY_VERIFIED',
        'Phone number already verified',
        400,
        'Resend OTP failed',
      );
    }

    // Generate new OTP code
    const otpCode = await this.createVerificationCode(
      user.id,
      VerificationType.PHONE_VERIFICATION,
      phone,
    );

    // Send OTP via SMS
    await this.smsService.sendOtp(phone, otpCode);

    return ResponseHelper.success(
      { phone },
      'AUTH.RESEND_OTP.SUCCESS',
      'OTP code has been resent!',
      200,
    );
  }

  /**
   * Login user
   */
  /**
   * Login user with phone or email
   */
  async login(loginDto: LoginDto) {
    const { identifier, password } = loginDto;

    // Determine if identifier is phone or email
    const isPhone = /^0[0-9]{9,10}$/.test(identifier);

    // Find user by phone or email
    const user = await this.prisma.user.findFirst({
      where: isPhone ? { phone: identifier } : { email: identifier },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.INVALID_CREDENTIALS,
        'Phone number/email or password is incorrect',
        401,
        'Login failed',
      );
    }

    // Check if phone is verified (for phone login)
    if (isPhone && !user.phoneVerified) {
      throw new ApiException(
        MessageCodes.ACCOUNT_NOT_VERIFIED,
        'Please verify your phone number first',
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
      throw new ApiException(
        MessageCodes.INVALID_CREDENTIALS,
        'Phone number/email or password is incorrect',
        401,
        'Login failed',
      );
    }

    // Generate tokens
    const tokens = await this.generateTokenPair(
      user.id,
      user.email,
      user.phone,
    );

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          fullName: googleUser.name,
          googleId: googleUser.googleId,
          picture: googleUser.picture,
          emailVerified: true,
          phoneVerified: false, // OAuth users don't need phone verification
          role: Role.STAFF,
          isActive: true,
        },
      });
    }

    // Generate tokens
    const tokens = await this.generateTokenPair(
      user.id,
      user.email,
      user.phone,
    );

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        payload.phone,
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
   * Validate user (used by JWT strategy)
   */
  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        avatar: true,
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
