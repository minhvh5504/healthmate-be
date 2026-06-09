import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
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
  ) {}
  /**
   * Create user medication
   */
  async create(createUserMedicationDto: CreateUserMedicationDto, userId: string) {
    const { schedules, frequency, selectedDays, ...medicationData } = createUserMedicationDto;

    const medication = await this.prisma.medication.findUnique({
      where: { id: medicationData.medicationId },
    });

    if (!medication) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.MEDICATION_NOT_FOUND, 'Medication not found', 404),
      );
    }

    if (medicationData.conditionId) {
      const condition = await this.prisma.medicationCondition.findUnique({
        where: { id: medicationData.conditionId },
      });
      if (!condition) {
        throw new NotFoundException(
          ResponseHelper.error('CONDITION_NOT_FOUND', 'Condition not found', 404),
        );
      }
    }

    const userMedication = await this.prisma.$transaction(async (tx) => {
      return tx.userMedication.create({
        data: {
          userId,
          ...medicationData,
          reminderSchedules: schedules?.length
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

    if (userMedication.reminderSchedules?.length) {
      await Promise.all(
        userMedication.reminderSchedules.map((schedule) => {
          // Tính thời gian uống thuốc
          const medicationTime = this.getNextScheduledTime(schedule.remindTime);
          // Nhắc trước 1 giờ
          const scheduledFor = new Date(medicationTime.getTime() - 60 * 60 * 1000);

          return this.notificationsService.createNotification({
            userId,
            type: 'medication_reminder',
            title: `Medication Reminder: ${medication.name}`,
            body: `You have a scheduled dose of ${schedule.dosage || ''} ${medication.name} in 1 hour.`,
            scheduledFor,
            iconType: 'medication',
            fcmData: {
              userMedicationId: userMedication.id,
              reminderScheduleId: schedule.id,
              type: 'REMINDER',
            },
          });
        }),
      );
    }

    return ResponseHelper.success(
      userMedication,
      MessageCodes.MEDICATION_CREATED,
      'User medication created successfully',
    );
  }

  /**
   * Scan medication
   */
  async scan(scanDto: ScanMedicationDto, userId: string) {
    const { scannedText, rawScannedData, shape } = scanDto;

    const cleanText = scannedText.trim().replace(/\s+/g, ' ');

    // 1. Try to find existing medications
    const keywords = cleanText.split(' ').filter((w) => w.length > 2);

    let matchedMedicationId: string | null = null;

    if (keywords.length > 0) {
      const candidates = await this.prisma.medication.findMany({
        where: {
          OR: [
            ...keywords.map((kw) => ({
              name: { contains: kw, mode: 'insensitive' as Prisma.QueryMode },
            })),
            ...keywords.map((kw) => ({
              genericName: { contains: kw, mode: 'insensitive' as Prisma.QueryMode },
            })),
          ],
        },
        take: 20,
      });

      if (candidates.length > 0) {
        // Evaluate candidates to prevent false positives
        const scoredCandidates = candidates.map((candidate) => {
          const nameLower = candidate.name.toLowerCase();
          const genericLower = (candidate.genericName || '').toLowerCase();

          let score = 0;
          let matchedKeywordsCount = 0;

          for (const kw of keywords) {
            const kwLower = kw.toLowerCase();
            const matchesName = nameLower.includes(kwLower);
            const matchesGeneric = genericLower.includes(kwLower);

            if (matchesName || matchesGeneric) {
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

    const normalizedRawScannedData = (rawScannedData as Prisma.InputJsonValue) ?? {
      source: 'OCR',
      rawText: cleanText,
      shape,
    };

    // 2. If there is no catalog match, create a draft medication from OCR text.
    // This still lets the user add it to their medication list and edit details later.
    const scanTask = await this.prisma.$transaction(async (tx) => {
      let medicationId = matchedMedicationId;

      if (!medicationId) {
        const draftMedication = await tx.medication.create({
          data: {
            name: this.buildDraftMedicationName(cleanText),
            form: shape ? shape.slice(0, 20) : undefined,
            description: cleanText
              ? 'Created from unmatched OCR scan: ' + cleanText
              : 'Created from unmatched OCR scan',
            createdBy: userId,
          },
        });

        medicationId = draftMedication.id;
      }

      return tx.medicationScanTask.create({
        data: {
          userId,
          medicationId,
          status: matchedMedicationId ? 'SUCCESS' : 'FAILED',
          scannedText: cleanText,
          rawScannedData: normalizedRawScannedData,
        },
        include: {
          medication: true,
        },
      });
    });

    return ResponseHelper.success(
      scanTask,
      matchedMedicationId ? 'MEDICATION.SCAN.SUCCESS' : 'MEDICATION.SCAN.FAILED',
      matchedMedicationId
        ? 'Medication matched successfully'
        : 'No matching medication found. Draft medication created from scan text',
    );
  }

  private buildDraftMedicationName(scannedText: string) {
    const fallbackName = 'Unrecognized medication scan';
    const name = scannedText || fallbackName;

    return name.slice(0, 255);
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
      'Scan tasks retrieved successfully',
    );
  }

  async deleteScanTask(id: string, userId: string) {
    const task = await this.prisma.medicationScanTask.findFirst({
      where: { id, userId },
    });

    if (!task) {
      throw new NotFoundException(
        ResponseHelper.error('SCAN_TASK_NOT_FOUND', 'Scan task not found', 404),
      );
    }

    await this.prisma.medicationScanTask.delete({ where: { id } });

    return ResponseHelper.success(null, 'SCAN_TASK_DELETED', 'Scan task deleted successfully');
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
      'User medications retrieved successfully',
    );
  }
  /**
   * Get daily schedule
   */
  async getDailySchedule(userId: string, dateStr: string) {
    const targetDate = new Date(dateStr);

    if (isNaN(targetDate.getTime())) {
      return ResponseHelper.error('INVALID_DATE', 'Invalid date format', 400);
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
        createdAt: {
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
        const isAsNeeded = schedule.repeatType === 'as_needed';

        if (!isDaily && !isSpecificDays && !isAsNeeded) continue;

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
      'Daily schedule retrieved successfully',
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
        ResponseHelper.error(MessageCodes.MEDICATION_NOT_FOUND, 'User medication not found', 404),
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
      'User medication retrieved successfully',
    );
  }
  /**
   * Update user medication
   */
  async update(id: string, userId: string, updateDto: UpdateUserMedicationDto) {
    const { schedules, frequency, selectedDays, ...medicationData } = updateDto;

    // Verify ownership
    const existing = await this.prisma.userMedication.findFirst({
      where: { id, userId },
      include: { reminderSchedules: true },
    });

    if (!existing) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.MEDICATION_NOT_FOUND, 'User medication not found', 404),
      );
    }

    if (updateDto.conditionId) {
      const condition = await this.prisma.medicationCondition.findUnique({
        where: { id: updateDto.conditionId },
      });
      if (!condition) {
        throw new NotFoundException(
          ResponseHelper.error('CONDITION_NOT_FOUND', 'Condition not found', 404),
        );
      }
    }

    const cleanMedicationData = Object.fromEntries(
      Object.entries(medicationData).filter(([, v]) => v !== undefined),
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Update basic fields (only fields that were actually provided)
      await tx.userMedication.update({
        where: { id },
        data: cleanMedicationData,
      });

      // 2. If schedules provided, replace them entirely
      if (schedules) {
        await tx.reminderSchedule.deleteMany({
          where: { userMedicationId: id },
        });

        // Create new ones
        if (schedules.length > 0) {
          await tx.reminderSchedule.createMany({
            data: schedules.map((s) => ({
              userMedicationId: id,
              remindTime: s.time,
              quantity: s.quantity,
              dosage: updateDto.dosage || existing.dosage,
              repeatType: frequency || existing.reminderSchedules[0]?.repeatType || 'daily',
              repeatDays: selectedDays || existing.reminderSchedules[0]?.repeatDays || [],
              isActive: updateDto.reminderEnabled ?? existing.reminderEnabled ?? true,
            })),
          });
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

    return ResponseHelper.success(
      updated,
      MessageCodes.MEDICATION_UPDATED,
      'User medication updated successfully',
    );
  }
  /**
   * Remove user medication
   */
  async remove(id: string, userId: string) {
    const existing = await this.prisma.userMedication.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.MEDICATION_NOT_FOUND, 'User medication not found', 404),
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
      'User medication deleted successfully',
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
