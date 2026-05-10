import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthAdminService } from './auth.service';
import { AdminLoginDto } from './dto/login.dto';
import { AdminRegisterDto } from './dto/register.dto';
import { AdminRefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('Admin Auth')
@Controller('admin/auth')
export class AuthAdminController {
  constructor(private readonly authAdminService: AuthAdminService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[Admin] Register a new admin with username - Returns tokens immediately',
  })
  @ApiResponse({
    status: 201,
    description: 'Registration successful, returns tokens',
  })
  @ApiResponse({
    status: 409,
    description: 'Username already registered',
  })
  async register(@Body() registerDto: AdminRegisterDto) {
    return this.authAdminService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Login with username' })
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.admin)
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
