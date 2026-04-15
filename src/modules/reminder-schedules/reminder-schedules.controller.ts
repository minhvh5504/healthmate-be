import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ReminderSchedulesService } from './reminder-schedules.service';
import { CreateReminderScheduleDto } from './dto/create-reminder-schedule.dto';
import { UpdateReminderScheduleDto } from './dto/update-reminder-schedule.dto';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Reminder Schedules')
@Controller('reminder-schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ReminderSchedulesController {
  constructor(private readonly reminderSchedulesService: ReminderSchedulesService) {}

  @Post()
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new reminder schedule' })
  @ApiResponse({ status: 201, description: 'Created successfully' })
  create(@Body() dto: CreateReminderScheduleDto, @Request() req) {
    return this.reminderSchedulesService.create(dto, req.user.id);
  }

  @Get()
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get reminder schedules by UserMedication ID' })
  findAll(@Query('userMedicationId') userMedicationId: string, @Request() req) {
    return this.reminderSchedulesService.findByUserMedication(userMedicationId, req.user.id);
  }

  @Patch(':id')
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a reminder schedule' })
  update(@Param('id') id: string, @Body() dto: UpdateReminderScheduleDto, @Request() req) {
    return this.reminderSchedulesService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a reminder schedule' })
  remove(@Param('id') id: string, @Request() req) {
    return this.reminderSchedulesService.remove(id, req.user.id);
  }
}
