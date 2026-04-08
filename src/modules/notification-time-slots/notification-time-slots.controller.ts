import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { NotificationTimeSlotsService } from './notification-time-slots.service';
import { CreateNotificationTimeSlotDto } from './dto/create-notification-time-slot.dto';
import { UpdateNotificationTimeSlotDto } from './dto/update-notification-time-slot.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Notification Time Slots')
@Controller('notification-time-slots')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class NotificationTimeSlotsController {
  constructor(private readonly service: NotificationTimeSlotsService) {}

  @Get()
  @Roles(Role.admin, Role.user)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all notification time slots' })
  @ApiResponse({
    status: 200,
    description: 'Notification time slots retrieved successfully',
  })
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @Roles(Role.admin)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new notification time slot (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Notification time slot created successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  create(@Body() createDto: CreateNotificationTimeSlotDto) {
    return this.service.create(createDto);
  }

  @Patch(':id')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a notification time slot (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Notification time slot updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'Notification time slot not found' })
  update(@Param('id') id: string, @Body() updateDto: UpdateNotificationTimeSlotDto) {
    return this.service.update(id, updateDto);
  }
}
