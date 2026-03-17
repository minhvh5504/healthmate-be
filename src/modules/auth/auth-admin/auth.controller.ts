import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthAdminService } from './auth.service';
import { AdminLoginDto } from './dto/login.dto';
import { AdminRegisterDto } from './dto/register.dto';
import { AdminRefreshTokenDto } from './dto/refresh-token.dto';
import { AdminVerifyEmailDto } from './dto/verify-email.dto';
import { AdminResendOtpDto } from './dto/resend-otp.dto';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Admin Auth')
@Controller('admin/auth')
export class AuthAdminController {
  constructor(private readonly authAdminService: AuthAdminService) { }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[Admin] Register a new with email - Sends OTP to email',
  })
  @ApiResponse({
    status: 201,
    description: 'Registration successful, OTP sent to email',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered',
  })
  async register(@Body() registerDto: AdminRegisterDto) {
    return this.authAdminService.register(registerDto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Admin] Verify account with OTP code',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully, returns tokens',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired OTP',
  })
  async verifyEmail(@Body() verifyEmailDto: AdminVerifyEmailDto) {
    return this.authAdminService.verifyOtp(verifyEmailDto);
  }

  @Public()
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Resend OTP verification code to email' })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Admin not found',
  })
  async resendOtp(@Body() resendOtpDto: AdminResendOtpDto) {
    return this.authAdminService.resendOtp(resendOtpDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Login with email' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns access and refresh tokens',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or account status',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  async login(@Body() loginDto: AdminLoginDto) {
    return this.authAdminService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Refresh access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
  })
  async refreshToken(@Body() refreshTokenDto: AdminRefreshTokenDto) {
    return this.authAdminService.refreshToken(refreshTokenDto);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Logout revoke refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
  })
  async logout(@Body() refreshTokenDto: AdminRefreshTokenDto) {
    return this.authAdminService.logout(refreshTokenDto.refreshToken);
  }
}
