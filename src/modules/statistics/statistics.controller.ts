import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Statistics')
@Controller('statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('dashboard')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Get general dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  getDashboardStats() {
    return this.statisticsService.getDashboardStats();
  }

  @Get('chart')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Get chart data for user growth' })
  @ApiResponse({ status: 200, description: 'Chart data retrieved successfully' })
  getChartData(@Query('type') type: 'week' | 'month' | 'year') {
    return this.statisticsService.getChartData(type);
  }

  @Get('recent-users')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Get 10 most recent users' })
  @ApiResponse({ status: 200, description: 'Recent users retrieved successfully' })
  getRecentUsers() {
    return this.statisticsService.getRecentUsers();
  }
}
