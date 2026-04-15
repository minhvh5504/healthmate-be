import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicationLogDto, MedicationLogStatus } from './dto/create-medication-log.dto';
import { UpdateMedicationLogDto } from './dto/update-medication-log.dto';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

@Injectable()
export class MedicationLogsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMedicationLogDto, userId: string) {
    // 1. Ownership check
    const userMedication = await this.prisma.userMedication.findUnique({
      where: { id: dto.userMedicationId },
    });

    if (!userMedication || userMedication.userId !== userId) {
      throw new ForbiddenException(
        ResponseHelper.error(
          MessageCodes.MEDICATION_NOT_FOUND,
          'User medication not found or access denied',
          403,
        ),
      );
    }

    // 2. Set default takenAt if status is taken and not provided
    const logData = { ...dto };
    if (logData.status === MedicationLogStatus.TAKEN && !logData.takenAt) {
      logData.takenAt = new Date();
    }

    // 3. Create log
    const log = await this.prisma.medicationLog.create({
      data: logData,
    });

    return ResponseHelper.success(
      log,
      MessageCodes.MEDICATION_LOG_CREATED,
      'Medication log recorded successfully',
    );
  }

  async findHistory(userId: string, userMedicationId?: string, range?: string, date?: string) {
    const referenceDate = date ? new Date(date) : new Date();

    const whereClause: any = {
      userMedication: {
        userId: userId,
      },
    };

    if (userMedicationId) {
      whereClause.userMedicationId = userMedicationId;
    }

    if (range) {
      let start: Date, end: Date;
      switch (range) {
        case 'day':
          start = startOfDay(referenceDate);
          end = endOfDay(referenceDate);
          break;
        case 'week':
          start = startOfWeek(referenceDate);
          end = endOfWeek(referenceDate);
          break;
        case 'month':
          start = startOfMonth(referenceDate);
          end = endOfMonth(referenceDate);
          break;
        default:
          start = startOfDay(referenceDate);
          end = endOfDay(referenceDate);
      }
      whereClause.createdAt = {
        gte: start,
        lte: end,
      };
    }

    const logs = await this.prisma.medicationLog.findMany({
      where: whereClause,
      include: {
        userMedication: {
          include: {
            medication: true,
          },
        },
        reminderSchedule: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return ResponseHelper.success(
      logs,
      MessageCodes.MEDICATION_LOG_LIST_RETRIEVED,
      'Medication logs retrieved successfully',
    );
  }

  async update(id: string, dto: UpdateMedicationLogDto, userId: string) {
    const existing = await this.prisma.medicationLog.findUnique({
      where: { id },
      include: { userMedication: true },
    });

    if (!existing) {
      throw new NotFoundException(
        ResponseHelper.error(
          MessageCodes.MEDICATION_LOG_NOT_FOUND,
          'Medication log not found',
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

    const updated = await this.prisma.medicationLog.update({
      where: { id },
      data: dto,
    });

    return ResponseHelper.success(
      updated,
      MessageCodes.MEDICATION_LOG_UPDATED,
      'Medication log updated successfully',
    );
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.medicationLog.findUnique({
      where: { id },
      include: { userMedication: true },
    });

    if (!existing) {
      throw new NotFoundException(
        ResponseHelper.error(
          MessageCodes.MEDICATION_LOG_NOT_FOUND,
          'Medication log not found',
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

    await this.prisma.medicationLog.delete({
      where: { id },
    });

    return ResponseHelper.success(
      null,
      MessageCodes.MEDICATION_LOG_DELETED,
      'Medication log deleted successfully',
    );
  }
}
