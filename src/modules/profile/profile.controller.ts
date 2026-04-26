import { Roles } from 'src/common/decorators/roles.decorator';
import { Controller, Get, Body, Patch, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from '@prisma/client';

@ApiTags('Profile')
@Controller('profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @Roles(Role.admin, Role.user)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized or account deactivated' })
  getProfile(@CurrentUser('id') userId: string) {
    return this.profileService.getProfile(userId);
  }

  @Patch()
  @Roles(Role.admin, Role.user)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized or account deactivated' })
  updateProfile(@CurrentUser('id') userId: string, @Body() updateProfileDto: UpdateProfileDto) {
    return this.profileService.updateProfile(userId, updateProfileDto);
  }

  @Get('health-analysis')
  @Roles(Role.admin, Role.user)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get BMI analysis compared to peers' })
  @ApiResponse({ status: 200, description: 'Health analysis retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized or account deactivated' })
  getHealthAnalysis(@CurrentUser('id') userId: string) {
    return this.profileService.getHealthAnalysis(userId);
  }
}
