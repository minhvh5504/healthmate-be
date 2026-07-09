import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Runs every minute to create upcoming medication reminders and deliver due notifications.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledNotifications() {
    await this.ensureUpcomingMedicationReminders();
    await this.ensureLowStockReminders();

    const now = new Date();

    const pendingNotifications = await this.prisma.notification.findMany({
      where: {
        deliveryStatus: 'pending',
        scheduledFor: {
          lte: now,
        },
      },
      select: { id: true, userId: true },
    });

    if (pendingNotifications.length === 0) {
      return;
    }

    this.logger.log(`Processing ${pendingNotifications.length} scheduled notifications`);

    for (const notification of pendingNotifications) {
      try {
        await this.notificationsService.sendExistingNotification(notification.id);
      } catch (error) {
        this.logger.error(`Failed to send notification ${notification.id}:`, error);

        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            deliveryStatus: 'failed',
            failureReason: error instanceof Error ? error.message : 'Lỗi không xác định',
          },
        });
      }
    }
  }

  /**
   * Ensure upcoming medication reminders
   */
  private async ensureUpcomingMedicationReminders() {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 2 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dateStrings = this.getVietnamDateStrings(now, 2);

    const schedules = await this.prisma.reminderSchedule.findMany({
      where: {
        isActive: true,
        remindTime: { not: null },
        userMedication: {
          isActive: true,
          reminderEnabled: true,
        },
      },
      include: {
        userMedication: {
          include: {
            medication: true,
          },
        },
      },
    });

    for (const schedule of schedules) {
      for (const dateStr of dateStrings) {
        if (!this.scheduleAppliesOnDate(schedule.repeatType, schedule.repeatDays, dateStr)) {
          continue;
        }

        if (!this.userMedicationAppliesOnDate(schedule.userMedication, dateStr)) {
          continue;
        }

        const medicationTime = this.buildMedicationDateTime(dateStr, schedule.remindTime);
        if (!medicationTime) continue;

        const scheduledFor = new Date(medicationTime.getTime() - 15 * 60 * 1000);
        if (scheduledFor < windowStart || scheduledFor > windowEnd) continue;

        await this.notificationsService.createMedicationReminderNotifications({
          ownerUserId: schedule.userMedication.userId,
          userMedicationId: schedule.userMedication.id,
          reminderScheduleId: schedule.id,
          medicationName: schedule.userMedication.medication.name,
          dosage: schedule.dosage,
          scheduledFor,
        });
      }
    }
  }

  /**
   * Ensure low stock reminders
   */
  private async ensureLowStockReminders() {
    const userMedications = await this.prisma.userMedication.findMany({
      where: {
        isActive: true,
        lowStockReminderEnabled: true,
        stockCount: { not: null },
      },
      include: { medication: true },
    });

    for (const userMedication of userMedications) {
      if (
        userMedication.stockCount === null ||
        userMedication.stockCount > userMedication.lowStockThreshold
      ) {
        continue;
      }

      await this.notificationsService.createMedicationStockReminderNotifications({
        ownerUserId: userMedication.userId,
        userMedicationId: userMedication.id,
        medicationName: userMedication.medication.name,
        stockCount: userMedication.stockCount,
        lowStockThreshold: userMedication.lowStockThreshold,
      });
    }
  }

  /**
   * Check schedule date match
   */
  private scheduleAppliesOnDate(repeatType: string, repeatDays: number[], dateStr: string) {
    if (repeatType === 'daily') return true;
    if (repeatType === 'specific_days') {
      return repeatDays.includes(this.getVietnamDayOfWeek(dateStr));
    }

    return false;
  }

  /**
   * Check medication date match
   */
  private userMedicationAppliesOnDate(
    userMedication: { startDate: Date | null; endDate: Date | null },
    dateStr: string,
  ) {
    if (userMedication.startDate && this.formatDateInVietnam(userMedication.startDate) > dateStr) {
      return false;
    }

    if (userMedication.endDate && this.formatDateInVietnam(userMedication.endDate) < dateStr) {
      return false;
    }

    return true;
  }

  /**
   * Build medication date time
   */
  private buildMedicationDateTime(dateStr: string, remindTime: string | null) {
    if (!remindTime) return null;

    const [hour, minute] = remindTime.split(':');
    if (!hour || !minute) return null;

    const hh = hour.padStart(2, '0');
    const mm = minute.padStart(2, '0');
    const medicationTime = new Date(`${dateStr}T${hh}:${mm}:00.000+07:00`);

    return isNaN(medicationTime.getTime()) ? null : medicationTime;
  }

  /**
   * Get Vietnam date strings
   */
  private getVietnamDateStrings(base: Date, count: number) {
    const today = this.formatDateInVietnam(base);
    const baseNoon = new Date(`${today}T12:00:00.000+07:00`);

    return Array.from({ length: count }, (_, index) => {
      const date = new Date(baseNoon);
      date.setUTCDate(date.getUTCDate() + index);
      return this.formatDateInVietnam(date);
    });
  }

  /**
   * Get Vietnam day of week
   */
  private getVietnamDayOfWeek(dateStr: string) {
    return new Date(`${dateStr}T12:00:00.000+07:00`).getUTCDay();
  }

  /**
   * Format date in Vietnam timezone
   */
  private formatDateInVietnam(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return `${year}-${month}-${day}`;
  }
}
