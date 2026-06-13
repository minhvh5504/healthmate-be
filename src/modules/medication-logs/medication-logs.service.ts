import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateMedicationLogDto, MedicationLogStatus } from './dto/create-medication-log.dto';
import { UpdateMedicationLogDto } from './dto/update-medication-log.dto';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { getMealInstructionFromTime } from '../../common/utils/medication-helper';
import { PrismaService } from '../prisma/prisma.service';

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

    // 2. Set default actualAt if status is taken and not provided
    const logData = { ...dto };
    if (logData.status === MedicationLogStatus.TAKEN && !logData.actualAt) {
      logData.actualAt = new Date();
    }

    // 3. Auto-calculate mealInstruction snapshot based on actualAt
    if (logData.actualAt) {
      const timeToCompare = new Date(logData.actualAt);
      logData.mealInstruction =
        logData.mealInstruction ||
        getMealInstructionFromTime(timeToCompare.getHours(), timeToCompare.getMinutes());
    }

    const takenQuantity =
      logData.status === MedicationLogStatus.TAKEN
        ? await this.getTakenQuantity(logData, userMedication.quantity)
        : 0;

    // 4. Create log and reduce stock when the medication was taken
    const log = await this.prisma.$transaction(async (tx) => {
      const createdLog = await tx.medicationLog.create({
        data: {
          ...logData,
        },
      });

      if (
        logData.status === MedicationLogStatus.TAKEN &&
        userMedication.stockCount !== null &&
        takenQuantity > 0
      ) {
        await tx.userMedication.update({
          where: { id: userMedication.id },
          data: {
            stockCount: Math.max(userMedication.stockCount - takenQuantity, 0),
          },
        });
      }

      return createdLog;
    });

    return ResponseHelper.success(
      log,
      MessageCodes.MEDICATION_LOG_CREATED,
      'Medication log recorded successfully',
    );
  }

  private async getTakenQuantity(
    logData: CreateMedicationLogDto,
    userMedicationQuantity: number | null,
  ) {
    if (logData.actualQuantity !== undefined) {
      return logData.actualQuantity;
    }

    if (logData.reminderScheduleId) {
      const reminderSchedule = await this.prisma.reminderSchedule.findFirst({
        where: { id: logData.reminderScheduleId, userMedicationId: logData.userMedicationId },
        select: { quantity: true },
      });

      if (reminderSchedule?.quantity !== null && reminderSchedule?.quantity !== undefined) {
        return reminderSchedule.quantity;
      }
    }

    return userMedicationQuantity ?? 1;
  }

  async findHistory(userId: string, userMedicationId?: string, range?: string, date?: string) {
    const referenceDate = date ? new Date(date) : new Date();

    const whereClause: Prisma.MedicationLogWhereInput = {
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

    const logsWithNumericQuantity = logs.map((log) => ({
      ...log,
      actualQuantity: log.actualQuantity ? Number(log.actualQuantity) : null,
      userMedication: log.userMedication
        ? {
            ...log.userMedication,
            quantity: log.userMedication.quantity ? Number(log.userMedication.quantity) : null,
          }
        : null,
    }));

    return ResponseHelper.success(
      logsWithNumericQuantity,
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
