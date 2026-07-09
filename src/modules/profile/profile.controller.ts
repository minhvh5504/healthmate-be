import { Roles } from 'src/common/decorators/roles.decorator';
import {
  Controller,
  Get,
  Body,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Param,
  Delete,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  HealthHistoryChangesQueryDto,
  HealthHistoryQueryDto,
} from './dto/health-history-query.dto';
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

  @Get('health-history')
  @Roles(Role.admin, Role.user)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get health history chart data by period' })
  @ApiResponse({ status: 200, description: 'Health history retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized or account deactivated' })
  getHealthHistory(@CurrentUser('id') userId: string, @Query() query: HealthHistoryQueryDto) {
    return this.profileService.getHealthHistory(userId, query);
  }

  @Get('health-history/changes')
  @Roles(Role.admin, Role.user)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get health metric change history' })
  @ApiResponse({ status: 200, description: 'Health metric changes retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized or account deactivated' })
  getHealthHistoryChanges(
    @CurrentUser('id') userId: string,
    @Query() query: HealthHistoryChangesQueryDto,
  ) {
    return this.profileService.getHealthHistoryChanges(userId, query);
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

  @Get('admin/all')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Get all users with pagination' })
  @ApiResponse({ status: 200, description: 'User list retrieved successfully' })
  findAllAdmin(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: 'active' | 'inactive' | 'all',
  ) {
    return this.profileService.findAllAdmin(
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
      status,
    );
  }

  @Get('admin/:id')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Get specific user details' })
  @ApiResponse({ status: 200, description: 'User details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOneAdmin(@Param('id') id: string) {
    return this.profileService.findOneAdmin(id);
  }

  @Patch('admin/:id/status')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Toggle user active status' })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  toggleUserStatus(@Param('id') id: string) {
    return this.profileService.toggleUserStatus(id);
  }

  @Delete('admin/:id')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Delete user account' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  deleteUser(@Param('id') id: string) {
    return this.profileService.deleteUser(id);
  }
}
