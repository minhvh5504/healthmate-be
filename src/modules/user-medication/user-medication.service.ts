import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UploadService } from '../upload/upload.service';
import { CreateUserMedicationDto } from './dto/create-user-medication.dto';
import { UpdateUserMedicationDto } from './dto/update-user-medication.dto';
import { ScanMedicationDto } from './dto/scan-medication.dto';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { Prisma } from '@prisma/client';
import { DailyScheduleItem } from '../../common/interfaces/daily-schedule-item.interface';
import { getMealInstructionFromTime } from '../../common/utils/medication-helper';

@Injectable()
export class UserMedicationService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private uploadService: UploadService,
  ) {}
  /**
   * Create user medication
   */
  async create(createUserMedicationDto: CreateUserMedicationDto, userId: string) {
    const { schedules, frequency, selectedDays, ...medicationData } = createUserMedicationDto;
    const isAsNeeded = frequency === 'as_needed';

    const medication = await this.prisma.medication.findUnique({
      where: { id: medicationData.medicationId },
    });

    if (!medication) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.MEDICATION_NOT_FOUND, 'Không tìm thấy thuốc', 404),
      );
    }

    if (medicationData.conditionId) {
      const condition = await this.prisma.medicationCondition.findUnique({
        where: { id: medicationData.conditionId },
      });
      if (!condition) {
        throw new NotFoundException(
          ResponseHelper.error('CONDITION_NOT_FOUND', 'Không tìm thấy tình trạng dùng thuốc', 404),
        );
      }
    }

    const userMedication = await this.prisma.$transaction(async (tx) => {
      return tx.userMedication.create({
        data: {
          userId,
          ...medicationData,
          ...(isAsNeeded ? { endDate: null, reminderEnabled: false } : {}),
          reminderSchedules: !isAsNeeded && schedules?.length
            ? {
                create: schedules.map((s) => ({
                  remindTime: s.time,
                  quantity: s.quantity,
                  dosage: medicationData.dosage,
                  repeatType: frequency || 'daily',
                  repeatDays: selectedDays || [],
                })),
              }
            : undefined,
        },
        include: {
          medication: true,
          condition: true,
          reminderSchedules: true,
        },
      });
    });

    if (medicationData.reminderEnabled !== false && userMedication.reminderSchedules?.length) {
      await Promise.all(
        userMedication.reminderSchedules.map((schedule) => {
          const medicationTime = this.getNextScheduledTime(schedule.remindTime);

          const scheduledFor = new Date(medicationTime.getTime() - 60 * 60 * 1000);

          return this.notificationsService.createMedicationReminderNotifications({
            ownerUserId: userId,
            userMedicationId: userMedication.id,
            reminderScheduleId: schedule.id,
            medicationName: medication.name,
            dosage: schedule.dosage,
            scheduledFor,
          });
        }),
      );
    }

    await this.maybeCreateLowStockReminder(userMedication, userId);

    return ResponseHelper.success(
      userMedication,
      MessageCodes.MEDICATION_CREATED,
      'Tạo thuốc của người dùng thành công',
    );
  }

  /**
   * Scan medication
   */
  async scan(scanDto: ScanMedicationDto, userId: string, imageFile?: Express.Multer.File) {
    const { scannedText, rawScannedData, shape } = scanDto;

    const cleanText = scannedText.trim().replace(/\s+/g, ' ');

    // 1. Try to find existing medications. OCR text from mobile is usually
    // accent-free, while medication names in DB are Vietnamese with accents.
    const normalizedScanText = this.normalizeSearchText(cleanText);
    const keywords = normalizedScanText.split(' ').filter((w) => w.length > 2);

    let matchedMedicationId: string | null = null;

    if (keywords.length > 0) {
      const candidates = await this.prisma.medication.findMany({
        where: {
          createdBy: null,
        },
        select: {
          id: true,
          name: true,
          genericName: true,
          manufacturer: true,
        },
      });

      if (candidates.length > 0) {
        // Evaluate candidates to prevent false positives.
        const scoredCandidates = candidates.map((candidate) => {
          const searchableText = this.normalizeSearchText(
            [candidate.name, candidate.genericName, candidate.manufacturer]
              .filter(Boolean)
              .join(' '),
          );

          let score = 0;
          let matchedKeywordsCount = 0;

          for (const kw of keywords) {
            if (searchableText.includes(kw)) {
              score += kw.length;
              matchedKeywordsCount++;
            }
          }

          return { candidate, score, matchedKeywordsCount };
        });

        scoredCandidates.sort((a, b) => b.score - a.score);
        const bestMatch = scoredCandidates[0];

        // Strict threshold
        if (
          bestMatch.matchedKeywordsCount >= 2 ||
          (bestMatch.matchedKeywordsCount === 1 && bestMatch.score >= 5)
        ) {
          matchedMedicationId = bestMatch.candidate.id;
        }
      }
    }

    let parsedRawScannedData: unknown = rawScannedData;
    if (typeof rawScannedData === 'string' && rawScannedData.trim()) {
      try {
        parsedRawScannedData = JSON.parse(rawScannedData);
      } catch {
        parsedRawScannedData = { raw: rawScannedData };
      }
    }

    const uploadedImage = imageFile
      ? await this.uploadService.uploadMedicationScanImage(imageFile)
      : null;

    const rawScannedDataObject =
      parsedRawScannedData &&
      typeof parsedRawScannedData === 'object' &&
      !Array.isArray(parsedRawScannedData)
        ? (parsedRawScannedData as Record<string, unknown>)
        : {
            source: 'OCR',
            rawText: cleanText,
            shape,
          };

    const normalizedRawScannedData = {
      ...rawScannedDataObject,
      ...(uploadedImage
        ? { imageUrl: uploadedImage.url, imagePublicId: uploadedImage.publicId }
        : {}),
    } as Prisma.InputJsonValue;

    // 2. Save the scan result. Failed scans keep OCR text/image only so the
    // client can let users add the medication manually.
    const scanTask = await this.prisma.medicationScanTask.create({
      data: {
        userId,
        medicationId: matchedMedicationId,
        status: matchedMedicationId ? 'SUCCESS' : 'FAILED',
        scannedText: cleanText,
        rawScannedData: normalizedRawScannedData,
        imageUrl: uploadedImage?.url,
        imagePublicId: uploadedImage?.publicId,
      },
      include: {
        medication: true,
      },
    });

    return ResponseHelper.success(
      scanTask,
      matchedMedicationId ? 'MEDICATION.SCAN.SUCCESS' : 'MEDICATION.SCAN.FAILED',
      matchedMedicationId
        ? 'Nhận diện thuốc thành công'
        : 'Không tìm thấy thuốc phù hợp. Kết quả OCR đã được lưu để xem lại thủ công',
    );
  }

  private buildDraftMedicationName(scannedText: string) {
    const fallbackName = 'Không nhận diện được thuốc từ ảnh quét';
    const name = scannedText || fallbackName;

    return name.slice(0, 255);
  }

  private normalizeSearchText(value: string) {
    return value
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Find all scan tasks
   */
  async findAllScanTasks(userId: string) {
    const tasks = await this.prisma.medicationScanTask.findMany({
      where: { userId },
      include: {
        medication: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return ResponseHelper.success(
      tasks,
      'SCAN_TASKS_RETRIEVED',
      'Lấy danh sách tác vụ quét thành công',
    );
  }

  async deleteScanTask(id: string, userId: string) {
    const task = await this.prisma.medicationScanTask.findFirst({
      where: { id, userId },
    });

    if (!task) {
      throw new NotFoundException(
        ResponseHelper.error('SCAN_TASK_NOT_FOUND', 'Không tìm thấy tác vụ quét', 404),
      );
    }

    await this.prisma.medicationScanTask.delete({ where: { id } });

    return ResponseHelper.success(null, 'SCAN_TASK_DELETED', 'Xóa tác vụ quét thành công');
  }

  async findAllByUser(userId: string) {
    const userMedications = await this.prisma.userMedication.findMany({
      where: { userId, isActive: true },
      include: {
        medication: true,
        condition: true,
        reminderSchedules: {
          where: { isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = userMedications.map((um) => ({
      ...um,
      quantity: um.quantity ? Number(um.quantity) : null,
      reminderSchedules: um.reminderSchedules.map((s) => ({
        ...s,
        quantity: s.quantity ? Number(s.quantity) : null,
      })),
    }));

    return ResponseHelper.success(
      formatted,
      MessageCodes.MEDICATION_LIST_RETRIEVED,
      'Lấy danh sách thuốc của người dùng thành công',
    );
  }
  /**
   * Get daily schedule
   */
  async getDailySchedule(userId: string, dateStr: string) {
    const targetDate = new Date(dateStr);

    if (isNaN(targetDate.getTime())) {
      return ResponseHelper.error('INVALID_DATE', 'Định dạng ngày không hợp lệ', 400);
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const dayOfWeek = targetDate.getDay();

    const userMedications = await this.prisma.userMedication.findMany({
      where: { userId, isActive: true },
      include: {
        medication: true,
        condition: true,
        reminderSchedules: {
          where: { isActive: true },
        },
      },
    });

    const dailyLogs = await this.prisma.medicationLog.findMany({
      where: {
        userMedication: { userId },
        actualAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const morning: DailyScheduleItem[] = [];
    const afternoon: DailyScheduleItem[] = [];
    const evening: DailyScheduleItem[] = [];

    for (const um of userMedications) {
      if (um.startDate && new Date(um.startDate) > endOfDay) continue;
      if (um.endDate && new Date(um.endDate) < startOfDay) continue;

      for (const schedule of um.reminderSchedules) {
        const isDaily = schedule.repeatType === 'daily';
        const isSpecificDays =
          schedule.repeatType === 'specific_days' && schedule.repeatDays.includes(dayOfWeek);

        if (!isDaily && !isSpecificDays) continue;

        const log = dailyLogs.find((l) => l.reminderScheduleId === schedule.id);

        let mealInstructionSlug = um.mealInstruction;

        if (!mealInstructionSlug && schedule.remindTime) {
          const [h, m] = schedule.remindTime.split(':').map(Number);
          mealInstructionSlug = getMealInstructionFromTime(h, m);
        }

        const scheduleItem: DailyScheduleItem = {
          userMedicationId: um.id,
          reminderScheduleId: schedule.id,
          medicationName: um.medication.name,
          dosage: schedule.dosage,
          quantity: schedule.quantity || 1,
          remindTime: schedule.remindTime,
          mealInstruction: mealInstructionSlug,
          status: log ? log.status : 'pending',
          logId: log ? log.id : null,
          actualAt: log ? log.actualAt : null,
          actualQuantity: log ? log.actualQuantity : null,
        };

        if (!schedule.remindTime) {
          morning.push(scheduleItem);
          continue;
        }

        const [hourStr] = schedule.remindTime.split(':');
        const hour = parseInt(hourStr, 10);

        if (hour < 12) {
          morning.push(scheduleItem);
        } else if (hour < 18) {
          afternoon.push(scheduleItem);
        } else {
          evening.push(scheduleItem);
        }
      }
    }

    const sortByTime = (a: DailyScheduleItem, b: DailyScheduleItem) => {
      if (!a.remindTime) return -1;
      if (!b.remindTime) return 1;
      return a.remindTime.localeCompare(b.remindTime);
    };

    morning.sort(sortByTime);
    afternoon.sort(sortByTime);
    evening.sort(sortByTime);

    return ResponseHelper.success(
      { morning, afternoon, evening },
      'DAILY_SCHEDULE_RETRIEVED',
      'Lấy lịch uống thuốc hằng ngày thành công',
    );
  }
  /**
   * Find one user medication
   */
  async findOne(id: string, userId: string) {
    const userMedication = await this.prisma.userMedication.findFirst({
      where: { id, userId },
      include: {
        medication: true,
        condition: true,
        reminderSchedules: true,
      },
    });

    if (!userMedication) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.MEDICATION_NOT_FOUND, 'Không tìm thấy thuốc của người dùng', 404),
      );
    }

    const formatted = {
      ...userMedication,
      quantity: userMedication.quantity ? Number(userMedication.quantity) : null,
      reminderSchedules: userMedication.reminderSchedules.map((s) => ({
        ...s,
        quantity: s.quantity ? Number(s.quantity) : null,
      })),
    };

    return ResponseHelper.success(
      formatted,
      MessageCodes.MEDICATION_RETRIEVED,
      'Lấy thông tin thuốc của người dùng thành công',
    );
  }
  /**
   * Update user medication
   */
  async update(id: string, userId: string, updateDto: UpdateUserMedicationDto) {
    const { schedules, frequency, selectedDays, ...medicationData } = updateDto;
    const isAsNeeded = frequency === 'as_needed';

    // Verify ownership
    const existing = await this.prisma.userMedication.findFirst({
      where: { id, userId },
      include: { reminderSchedules: true },
    });

    if (!existing) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.MEDICATION_NOT_FOUND, 'Không tìm thấy thuốc của người dùng', 404),
      );
    }

    if (updateDto.conditionId) {
      const condition = await this.prisma.medicationCondition.findUnique({
        where: { id: updateDto.conditionId },
      });
      if (!condition) {
        throw new NotFoundException(
          ResponseHelper.error('CONDITION_NOT_FOUND', 'Không tìm thấy tình trạng dùng thuốc', 404),
        );
      }
    }

    const cleanMedicationData = Object.fromEntries(
      Object.entries(medicationData).filter(([, v]) => v !== undefined),
    );
    if (isAsNeeded) {
      cleanMedicationData.endDate = null;
      cleanMedicationData.reminderEnabled = false;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Update basic fields (only fields that were actually provided)
      await tx.userMedication.update({
        where: { id },
        data: cleanMedicationData,
      });

      // 2. If schedules provided, update existing rows in place so medication logs
      // keep matching by reminderScheduleId after a time or quantity edit.
      // As-needed medicines are logged manually, so they must not keep schedules.
      if (isAsNeeded) {
        await tx.reminderSchedule.deleteMany({
          where: { userMedicationId: id },
        });
      } else if (schedules) {
        const existingSchedulesById = new Map(
          existing.reminderSchedules.map((s) => [s.id, s]),
        );
        const incomingExistingIds = schedules
          .map((s) => s.id)
          .filter((scheduleId): scheduleId is string => Boolean(scheduleId));
        const firstExistingSchedule = existing.reminderSchedules[0];

        await tx.reminderSchedule.updateMany({
          where: {
            userMedicationId: id,
            id: { notIn: incomingExistingIds },
          },
          data: { isActive: false },
        });

        for (const schedule of schedules) {
          const existingSchedule = schedule.id ? existingSchedulesById.get(schedule.id) : undefined;
          const scheduleData = {
            remindTime: schedule.time,
            quantity: schedule.quantity,
            dosage: updateDto.dosage || existing.dosage,
            repeatType:
              frequency || existingSchedule?.repeatType || firstExistingSchedule?.repeatType || 'daily',
            repeatDays:
              selectedDays || existingSchedule?.repeatDays || firstExistingSchedule?.repeatDays || [],
            isActive: updateDto.reminderEnabled ?? existing.reminderEnabled ?? true,
          };

          if (existingSchedule) {
            const repeatDaysChanged =
              JSON.stringify(existingSchedule.repeatDays) !== JSON.stringify(scheduleData.repeatDays);
            const scheduleChanged =
              existingSchedule.remindTime !== scheduleData.remindTime ||
              existingSchedule.quantity !== scheduleData.quantity ||
              existingSchedule.dosage !== scheduleData.dosage ||
              existingSchedule.repeatType !== scheduleData.repeatType ||
              repeatDaysChanged ||
              existingSchedule.isActive !== scheduleData.isActive;

            if (scheduleChanged) {
              await tx.reminderSchedule.update({
                where: { id: existingSchedule.id },
                data: scheduleData,
              });
            }
          } else {
            await tx.reminderSchedule.create({
              data: {
                userMedicationId: id,
                ...scheduleData,
              },
            });
          }
        }
      } else {
        // Build partial update for existing schedules
        const scheduleUpdate: Record<string, any> = {};
        if (frequency) scheduleUpdate.repeatType = frequency;
        if (selectedDays) scheduleUpdate.repeatDays = selectedDays;
        // If reminderEnabled changed, toggle isActive on all schedules
        if (updateDto.reminderEnabled !== undefined) {
          scheduleUpdate.isActive = updateDto.reminderEnabled;
        }

        if (Object.keys(scheduleUpdate).length > 0) {
          await tx.reminderSchedule.updateMany({
            where: { userMedicationId: id },
            data: scheduleUpdate,
          });
        }
      }

      return tx.userMedication.findUnique({
        where: { id },
        include: {
          medication: true,
          condition: true,
          reminderSchedules: true,
        },
      });
    });

    if (updateDto.reminderEnabled === false) {
      await this.notificationsService.cancelPendingMedicationRemindersForUserMedication(id);
    }

    await this.maybeCreateLowStockReminder(updated, userId);

    return ResponseHelper.success(
      updated,
      MessageCodes.MEDICATION_UPDATED,
      'Cập nhật thuốc của người dùng thành công',
    );
  }
  /**
   * Remove user medication
   */

  private async maybeCreateLowStockReminder(
    userMedication: {
      id: string;
      userId: string;
      stockCount: number | null;
      lowStockThreshold: number;
      lowStockReminderEnabled: boolean;
      medication?: { name: string } | null;
    } | null,
    fallbackUserId: string,
  ) {
    if (
      !userMedication?.lowStockReminderEnabled ||
      userMedication.stockCount === null ||
      userMedication.stockCount > userMedication.lowStockThreshold ||
      !userMedication.medication
    ) {
      return;
    }

    await this.notificationsService.createMedicationStockReminderNotifications({
      ownerUserId: userMedication.userId || fallbackUserId,
      userMedicationId: userMedication.id,
      medicationName: userMedication.medication.name,
      stockCount: userMedication.stockCount,
      lowStockThreshold: userMedication.lowStockThreshold,
    });
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.userMedication.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.MEDICATION_NOT_FOUND, 'Không tìm thấy thuốc của người dùng', 404),
      );
    }

    // Soft delete or hard delete based on preference. Here we do hard delete.
    // Actually, maybe update isActive = false
    await this.prisma.userMedication.update({
      where: { id },
      data: { isActive: false },
    });

    return ResponseHelper.success(
      null,
      MessageCodes.MEDICATION_DELETED,
      'Xóa thuốc của người dùng thành công',
    );
  }

  /**
   * Calculate the next datetime for a given "HH:mm" reminder time.
   * If the time hasn't passed today, return today's date; otherwise tomorrow.
   */
  private getNextScheduledTime(remindTime: string | null): Date {
    const now = new Date();

    if (!remindTime) return now;

    const [hourStr, minuteStr] = remindTime.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    const scheduled = new Date(now);
    scheduled.setHours(hour, minute, 0, 0);

    // If this moment has already passed today, schedule for tomorrow
    if (scheduled <= now) {
      scheduled.setDate(scheduled.getDate() + 1);
    }

    return scheduled;
  }
}
