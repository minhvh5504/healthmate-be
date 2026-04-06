import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationTimeSlotsService } from './notification-time-slots.service';
import { CreateNotificationTimeSlotDto } from './dto/create-notification-time-slot.dto';
import { UpdateNotificationTimeSlotDto } from './dto/update-notification-time-slot.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Notification Time Slots')
@Controller('notification-time-slots')
export class NotificationTimeSlotsController {
  constructor(private readonly service: NotificationTimeSlotsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notification time slots' })
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Create a new notification time slot (Admin only)' })
  create(@Body() createDto: CreateNotificationTimeSlotDto) {
    return this.service.create(createDto);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Update a notification time slot (Admin only)' })
  update(@Param('id') id: string, @Body() updateDto: UpdateNotificationTimeSlotDto) {
    return this.service.update(id, updateDto);
  }
}
