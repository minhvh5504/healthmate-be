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
   * Runs every minute to check for pending notifications that are due for delivery.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledNotifications() {
    const now = new Date();

    // Find all pending notifications that should have been sent by now
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

        // Update failure status
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            deliveryStatus: 'failed',
            failureReason: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  }
}
