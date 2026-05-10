import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminLoginDto } from './dto/login.dto';
import { AdminRegisterDto } from './dto/register.dto';
import { AdminRefreshTokenDto } from './dto/refresh-token.dto';
import { Role } from '@prisma/client';
import { ResponseHelper } from '../../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../../common/constants/message-codes.const';
import { ApiException } from '../../../common/exceptions/api.exception';
import * as ms from 'ms';
import type { StringValue } from 'ms';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface JwtPayload {
  sub: string;
  email: string | null;
  username: string | null;
  role: Role;
}

@Injectable()
export class AuthAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate access and refresh tokens
   */
  private async generateTokenPair(
    userId: string,
    email: string | null,
    username: string | null,
    role: Role,
  ): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, email, username, role };

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
    const { username, password } = registerDto;

    // Check if username already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      throw new ApiException(
        MessageCodes.USER_ALREADY_EXISTS,
        'Username already registered',
        409,
        'Register failed',
      );
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user with usernameVerified = true and Role.admin
    const user = await this.prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        profile: {
          create: {
            fullName: this.generateDefaultFullName(),
          },
        },
        role: Role.admin,
        isActive: true,
      },
      include: {
        profile: true,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokenPair(user.id, user.email, user.username, user.role);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;

    return ResponseHelper.success(
      {
        user: userWithoutPassword,
        ...tokens,
      },
      MessageCodes.REGISTER_SUCCESS,
      'Admin registered successfully!',
      201,
    );
  }

  /**
   * Login admin with email
   */
  async login(loginDto: AdminLoginDto) {
    const { username, password } = loginDto;

    // Find user by username and check if it's an admin
    const user = await this.prisma.user.findFirst({
      where: { username },
      include: { profile: true },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.INVALID_CREDENTIALS,
        'Username or password is incorrect',
        401,
        'Login failed',
      );
    }

    // Check if user is an admin
    if (user.role !== Role.admin) {
      throw new ApiException(
        MessageCodes.INSUFFICIENT_PERMISSIONS,
        'You do not have permission to access the admin portal',
        403,
        'Login failed',
      );
    }

    // Verify password
    const isPasswordValid = await this.comparePasswords(password, user.password || '');

    if (!isPasswordValid) {
      throw new ApiException(
        MessageCodes.INVALID_CREDENTIALS,
        'Username or password is incorrect',
        401,
        'Login failed',
      );
    }

    // Generate tokens
    const tokens = await this.generateTokenPair(user.id, user.email, user.username, user.role);

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;

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
      if (storedToken.user.role !== Role.admin) {
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
        payload.username,
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
      include: { profile: true },
    });

    if (!user || user.role !== Role.admin || !user.isActive) {
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
  private async comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
