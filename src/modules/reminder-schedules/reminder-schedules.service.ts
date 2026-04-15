import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReminderScheduleDto } from './dto/create-reminder-schedule.dto';
import { UpdateReminderScheduleDto } from './dto/update-reminder-schedule.dto';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';

@Injectable()
export class ReminderSchedulesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateReminderScheduleDto, userId: string) {
    // 1. Verify UserMedication existence and ownership
    const userMedication = await this.prisma.userMedication.findUnique({
      where: { id: dto.userMedicationId },
    });

    if (!userMedication) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.MEDICATION_NOT_FOUND, 'User medication not found', 404),
      );
    }

    if (userMedication.userId !== userId) {
      throw new ForbiddenException(
        ResponseHelper.error(
          MessageCodes.INSUFFICIENT_PERMISSIONS,
          'Insufficient permissions',
          403,
        ),
      );
    }

    // 2. Create Schedule
    const schedule = await this.prisma.reminderSchedule.create({
      data: dto,
    });

    return ResponseHelper.success(
      schedule,
      MessageCodes.REMINDER_SCHEDULE_CREATED,
      'Reminder schedule created successfully',
    );
  }

  async findByUserMedication(userMedicationId: string, userId: string) {
    // Ownership check
    const userMedication = await this.prisma.userMedication.findUnique({
      where: { id: userMedicationId },
    });

    if (!userMedication || userMedication.userId !== userId) {
      throw new NotFoundException(
        ResponseHelper.error(
          MessageCodes.MEDICATION_NOT_FOUND,
          'User medication not found or access denied',
          404,
        ),
      );
    }

    const schedules = await this.prisma.reminderSchedule.findMany({
      where: { userMedicationId },
      orderBy: { remindTime: 'asc' },
    });

    return ResponseHelper.success(
      schedules,
      MessageCodes.REMINDER_SCHEDULE_LIST_RETRIEVED,
      'Reminder schedules retrieved successfully',
    );
  }

  async update(id: string, dto: UpdateReminderScheduleDto, userId: string) {
    const existing = await this.prisma.reminderSchedule.findUnique({
      where: { id },
      include: { userMedication: true },
    });

    if (!existing) {
      throw new NotFoundException(
        ResponseHelper.error(
          MessageCodes.REMINDER_SCHEDULE_NOT_FOUND,
          'Reminder schedule not found',
          404,
        ),
      );
    }

    if (existing.userMedication.userId !== userId) {
      throw new ForbiddenException(
        ResponseHelper.error(
          MessageCodes.INSUFFICIENT_PERMISSIONS,
          'Insufficient permissions',
          403,
        ),
      );
    }

    const updated = await this.prisma.reminderSchedule.update({
      where: { id },
      data: dto,
    });

    return ResponseHelper.success(
      updated,
      MessageCodes.REMINDER_SCHEDULE_UPDATED,
      'Reminder schedule updated successfully',
    );
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.reminderSchedule.findUnique({
      where: { id },
      include: { userMedication: true },
    });

    if (!existing) {
      throw new NotFoundException(
        ResponseHelper.error(
          MessageCodes.REMINDER_SCHEDULE_NOT_FOUND,
          'Reminder schedule not found',
          404,
        ),
      );
    }

    if (existing.userMedication.userId !== userId) {
      throw new ForbiddenException(
        ResponseHelper.error(
          MessageCodes.INSUFFICIENT_PERMISSIONS,
          'Insufficient permissions',
          403,
        ),
      );
    }

    await this.prisma.reminderSchedule.delete({
      where: { id },
    });

    return ResponseHelper.success(
      null,
      MessageCodes.REMINDER_SCHEDULE_DELETED,
      'Reminder schedule deleted successfully',
    );
  }
}
