import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateUserMedicationDto } from './dto/create-user-medication.dto';
import { UpdateUserMedicationDto } from './dto/update-user-medication.dto';
import { ScanMedicationDto } from './dto/scan-medication.dto';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { Prisma } from '@prisma/client';

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

    // 1. Verify medication exists
    const medication = await this.prisma.medication.findUnique({
      where: { id: medicationData.medicationId },
    });

    if (!medication) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.MEDICATION_NOT_FOUND, 'Medication not found', 404),
      );
    }

    // 2. Check condition if provided
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

    // 3. Use transaction to create UserMedication + ReminderSchedules atomically
    const userMedication = await this.prisma.$transaction(async (tx) => {
      return tx.userMedication.create({
        data: {
          userId,
          ...medicationData,
          // Nested create for each schedule slot sent from mobile
          reminderSchedules: schedules?.length
            ? {
                create: schedules.map((s) => ({
                  remindTime: s.time,
                  dosage: s.doses.toString(),
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

    // 4. Create a pending Notification for each ReminderSchedule
    if (userMedication.reminderSchedules?.length) {
      await Promise.all(
        userMedication.reminderSchedules.map((schedule) => {
          const scheduledFor = this.getNextScheduledTime(schedule.remindTime);
          return this.prisma.notification.create({
            data: {
              userId,
              reminderScheduleId: schedule.id,
              type: 'medication_reminder',
              channel: 'push',
              iconType: 'medication',
              title: `Time to take ${medication.name}`,
              body: (schedule as any).dosage
                ? `Take ${(schedule as any).dosage} of ${medication.name}`
                : `Don't forget to take ${medication.name}`,
              scheduledFor,
              deliveryStatus: 'pending',
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
    const { scannedText, rawScannedData } = scanDto;

    // Remove noise
    const cleanText = scannedText.trim().replace(/\n/g, ' ');

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

    // 2. Create ScanTask (Always)
    const scanTask = await this.prisma.medicationScanTask.create({
      data: {
        userId,
        medicationId: matchedMedicationId,
        status: matchedMedicationId ? 'SUCCESS' : 'FAILED',
        scannedText: cleanText,
        rawScannedData: (rawScannedData as Prisma.InputJsonValue) ?? {
          source: 'OCR',
          rawText: cleanText,
        },
      },
      include: {
        medication: true,
      },
    });

    // 3. If matched, also create UserMedication directly
    if (matchedMedicationId) {
      await this.prisma.userMedication.create({
        data: {
          userId,
          medicationId: matchedMedicationId,
          scannedData: scanTask.rawScannedData as Prisma.InputJsonValue,
          isActive: true,
        },
      });
    }

    return ResponseHelper.success(
      scanTask,
      matchedMedicationId ? 'MEDICATION.SCAN.SUCCESS' : 'MEDICATION.SCAN.FAILED',
      matchedMedicationId
        ? 'Medication matched and added successfully'
        : 'No matching medication found',
    );
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

    return ResponseHelper.success(
      userMedications,
      MessageCodes.MEDICATION_LIST_RETRIEVED,
      'User medications retrieved successfully',
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

    return ResponseHelper.success(
      userMedication,
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
              dosage: s.doses.toString(),
              repeatType:
                frequency || (existing.reminderSchedules[0] as any)?.repeatType || 'daily',
              repeatDays: selectedDays || (existing.reminderSchedules[0] as any)?.repeatDays || [],
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
