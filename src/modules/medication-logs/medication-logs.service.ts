import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateMedicationLogDto, MedicationLogStatus } from './dto/create-medication-log.dto';
import { UpdateMedicationLogDto } from './dto/update-medication-log.dto';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { getMealInstructionFromTime } from '../../common/utils/medication-helper';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MedicationLogsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Create medication log
   */
  async create(dto: CreateMedicationLogDto, userId: string) {
    // 1. Ownership check
    const userMedication = await this.prisma.userMedication.findUnique({
      where: { id: dto.userMedicationId },
    });

    if (!userMedication || userMedication.userId !== userId) {
      throw new ForbiddenException(
        ResponseHelper.error(
          MessageCodes.MEDICATION_NOT_FOUND,
          'Không tìm thấy thuốc của người dùng hoặc bạn không có quyền truy cập',
          403,
        ),
      );
    }

    // 2. Set default actualAt if the client did not provide the intended log date
    const logData = { ...dto };
    if (!logData.actualAt) {
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
    let updatedStockCount: number | null = userMedication.stockCount;

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
        updatedStockCount = Math.max(userMedication.stockCount - takenQuantity, 0);
        await tx.userMedication.update({
          where: { id: userMedication.id },
          data: {
            stockCount: updatedStockCount,
          },
        });
      }

      return createdLog;
    });

    if (
      logData.status === MedicationLogStatus.TAKEN &&
      userMedication.lowStockReminderEnabled &&
      updatedStockCount !== null &&
      updatedStockCount <= userMedication.lowStockThreshold
    ) {
      const medication = await this.prisma.medication.findUnique({
        where: { id: userMedication.medicationId },
        select: { name: true },
      });

      if (medication) {
        await this.notificationsService.createMedicationStockReminderNotifications({
          ownerUserId: userMedication.userId,
          userMedicationId: userMedication.id,
          medicationName: medication.name,
          stockCount: updatedStockCount,
          lowStockThreshold: userMedication.lowStockThreshold,
        });
      }
    }

    return ResponseHelper.success(
      log,
      MessageCodes.MEDICATION_LOG_CREATED,
      'Ghi nhận lịch sử uống thuốc thành công',
    );
  }

  /**
   * Resolve taken quantity
   */
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

  /**
   * Get medication log history
   */
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
      whereClause.actualAt = {
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
      orderBy: [{ actualAt: 'desc' }, { createdAt: 'desc' }],
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
      'Lấy lịch sử uống thuốc thành công',
    );
  }

  /**
   * Update medication log
   */
  async update(id: string, dto: UpdateMedicationLogDto, userId: string) {
    const existing = await this.prisma.medicationLog.findUnique({
      where: { id },
      include: { userMedication: true },
    });

    if (!existing) {
      throw new NotFoundException(
        ResponseHelper.error(
          MessageCodes.MEDICATION_LOG_NOT_FOUND,
          'Không tìm thấy lịch sử uống thuốc',
          404,
        ),
      );
    }

    if (existing.userMedication.userId !== userId) {
      throw new ForbiddenException(
        ResponseHelper.error(MessageCodes.INSUFFICIENT_PERMISSIONS, 'Bạn không có đủ quyền', 403),
      );
    }

    const updated = await this.prisma.medicationLog.update({
      where: { id },
      data: dto,
    });

    return ResponseHelper.success(
      updated,
      MessageCodes.MEDICATION_LOG_UPDATED,
      'Cập nhật lịch sử uống thuốc thành công',
    );
  }

  /**
   * Delete medication log
   */
  async remove(id: string, userId: string) {
    const existing = await this.prisma.medicationLog.findUnique({
      where: { id },
      include: { userMedication: true },
    });

    if (!existing) {
      throw new NotFoundException(
        ResponseHelper.error(
          MessageCodes.MEDICATION_LOG_NOT_FOUND,
          'Không tìm thấy lịch sử uống thuốc',
          404,
        ),
      );
    }

    if (existing.userMedication.userId !== userId) {
      throw new ForbiddenException(
        ResponseHelper.error(MessageCodes.INSUFFICIENT_PERMISSIONS, 'Bạn không có đủ quyền', 403),
      );
    }

    await this.prisma.medicationLog.delete({
      where: { id },
    });

    return ResponseHelper.success(
      null,
      MessageCodes.MEDICATION_LOG_DELETED,
      'Xóa lịch sử uống thuốc thành công',
    );
  }
}
