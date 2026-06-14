import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { FcmService } from '../firebase/fcm.service';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification, Prisma } from '@prisma/client';

export interface CreateNotificationPayload {
  userId: string;
  reminderScheduleId?: string;
  type: string;
  title: string;
  body: string;
  iconType?: string;
  actionUrl?: string;
  scheduledFor?: Date;
  /** Extra key-value pairs forwarded to FCM data payload */
  fcmData?: Record<string, string>;
}

export interface CreateMedicationReminderPayload {
  ownerUserId: string;
  userMedicationId: string;
  reminderScheduleId: string;
  medicationName: string;
  dosage?: string | null;
  scheduledFor: Date;
}

export interface CreateMedicationStockReminderPayload {
  ownerUserId: string;
  userMedicationId: string;
  medicationName: string;
  stockCount: number;
  lowStockThreshold: number;
}

type MedicationReminderNotificationPayload = CreateNotificationPayload & {
  reminderScheduleId: string;
  scheduledFor: Date;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly fcmService: FcmService,
  ) {}

  async findAll(userId: string, query: QueryNotificationDto) {
    const { isRead, type, search, limit = 20, page = 1 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { userId };
    if (isRead !== undefined) where.isRead = isRead;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        take: limit,
        skip,
        orderBy: { scheduledFor: 'desc' },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        limit,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount: count };
  }

  async findOne(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  async create(userId: string, dto: CreateNotificationDto) {
    const targetUserId = dto.userId || userId;

    const notification = await this.prisma.notification.create({
      data: {
        userId: targetUserId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        iconType: dto.iconType || 'info',
        actionUrl: dto.actionUrl,
        scheduledFor: dto.scheduledFor || new Date(),
        deliveryStatus: 'sent',
        sentAt: new Date(),
      },
    });

    // Emit real-time WebSocket notification (foreground)
    this.realtimeGateway.emitNotificationToUser(
      targetUserId,
      notification as unknown as Record<string, unknown>,
    );

    // Update unread badge count via WebSocket
    const unreadCount = await this.prisma.notification.count({
      where: { userId: targetUserId, isRead: false },
    });
    this.realtimeGateway.emitUnreadCountToUser(targetUserId, unreadCount);

    // Send FCM push notification (background / terminated) — fire & forget
    void this.sendFcmToUserDevices(targetUserId, dto.title, dto.body);

    return notification;
  }

  async markAsRead(userId: string, id: string) {
    const updated = await this.prisma.notification.update({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });

    // Update badge count via WebSocket
    await this.refreshUnreadBadge(userId);

    return updated;
  }

  async markReadBulk(userId: string, ids?: string[], all?: boolean) {
    const where: Prisma.NotificationUpdateManyArgs['where'] = { userId, isRead: false };

    if (!all && ids && ids.length > 0) {
      where.id = { in: ids };
    } else if (!all && (!ids || ids.length === 0)) {
      return { count: 0 };
    }

    const result = await this.prisma.notification.updateMany({
      where,
      data: { isRead: true, readAt: new Date() },
    });

    // Update badge count via WebSocket
    await this.refreshUnreadBadge(userId);

    return result;
  }

  /**
   * Sends an already created notification that was pending
   */
  async sendExistingNotification(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      include: {
        reminderSchedule: {
          include: { userMedication: true },
        },
      },
    });

    if (!notification || notification.deliveryStatus !== 'pending') {
      return;
    }

    if (
      notification.type === 'medication_reminder' &&
      (!notification.reminderSchedule?.isActive ||
        !notification.reminderSchedule.userMedication.isActive ||
        !notification.reminderSchedule.userMedication.reminderEnabled)
    ) {
      await this.prisma.notification.update({
        where: { id },
        data: {
          deliveryStatus: 'cancelled',
          failureReason: 'Medication reminder is disabled',
        },
      });
      return;
    }

    const now = new Date();

    // 1. Update status to sent immediately to avoid double processing if possible
    await this.prisma.notification.update({
      where: { id },
      data: {
        deliveryStatus: 'sent',
        sentAt: now,
      },
    });

    // 2. Real-time WebSocket push (foreground)
    this.realtimeGateway.emitNotificationToUser(
      notification.userId,
      notification as unknown as Record<string, unknown>,
    );

    // 3. FCM push (background / terminated) — fire & forget
    void this.sendFcmToUserDevices(notification.userId, notification.title, notification.body);

    // 4. Update badge count
    await this.refreshUnreadBadge(notification.userId);
  }

  async remove(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return await this.prisma.notification.delete({ where: { id } });
  }

  async removeBulk(userId: string, ids?: string[], all?: boolean) {
    const where: Prisma.NotificationDeleteManyArgs['where'] = { userId };

    if (!all && ids && ids.length > 0) {
      where.id = { in: ids };
    } else if (!all && (!ids || ids.length === 0)) {
      return { count: 0 };
    }

    return await this.prisma.notification.deleteMany({ where });
  }

  /**
   * Internal method: create notification + emit WebSocket + send FCM push
   * Used by ReminderSchedulesService and other internal services
   */
  async createNotification(payload: CreateNotificationPayload) {
    const now = new Date();
    const isFuture = payload.scheduledFor && payload.scheduledFor > now;

    const notification = await this.prisma.notification.create({
      data: {
        userId: payload.userId,
        reminderScheduleId: payload.reminderScheduleId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        iconType: payload.iconType ?? 'info',
        actionUrl: payload.actionUrl,
        scheduledFor: payload.scheduledFor ?? now,
        deliveryStatus: isFuture ? 'pending' : 'sent',
        sentAt: isFuture ? null : now,
      },
    });

    // Chỉ gửi ngay nếu không phải là lịch hẹn trong tương lai
    if (!isFuture) {
      // Real-time WebSocket push (foreground)
      this.realtimeGateway.emitNotificationToUser(
        payload.userId,
        notification as unknown as Record<string, unknown>,
      );

      // FCM push (background / terminated) — fire & forget
      void this.sendFcmToUserDevices(payload.userId, payload.title, payload.body, payload.fcmData);
    }

    // Luôn cập nhật badge số thông báo chưa đọc
    const unreadCount = await this.prisma.notification.count({
      where: { userId: payload.userId, isRead: false },
    });
    this.realtimeGateway.emitUnreadCountToUser(payload.userId, unreadCount);

    return notification;
  }

  async createMedicationReminderNotifications(payload: CreateMedicationReminderPayload) {
    const userMedication = await this.prisma.userMedication.findUnique({
      where: { id: payload.userMedicationId },
      select: { isActive: true, reminderEnabled: true },
    });

    if (!userMedication?.isActive || !userMedication.reminderEnabled) {
      return [];
    }

    const [ownerDisplayName, relatedUserIds] = await Promise.all([
      this.getUserDisplayName(payload.ownerUserId),
      this.getAcceptedRelatedUserIds(payload.ownerUserId),
    ]);

    const medicationDose = this.formatMedicationDose(payload.dosage, payload.medicationName);
    const baseFcmData = {
      userMedicationId: payload.userMedicationId,
      reminderScheduleId: payload.reminderScheduleId,
    };

    const ownerNotification = await this.createMedicationReminderIfNotExists({
      userId: payload.ownerUserId,
      reminderScheduleId: payload.reminderScheduleId,
      type: 'medication_reminder',
      title: 'Medication Reminder',
      body: `You have a scheduled dose of ${medicationDose} in 1 hour.`,
      scheduledFor: payload.scheduledFor,
      iconType: 'medication',
      fcmData: {
        ...baseFcmData,
        type: 'REMINDER',
      },
    });

    const relatedNotifications = await Promise.all(
      relatedUserIds.map((relatedUserId) =>
        this.createMedicationReminderIfNotExists({
          userId: relatedUserId,
          reminderScheduleId: payload.reminderScheduleId,
          type: 'medication_reminder',
          title: 'Medication Reminder',
          body: `Please remind ${ownerDisplayName} to take ${medicationDose} in 1 hour.`,
          scheduledFor: payload.scheduledFor,
          iconType: 'medication',
          fcmData: {
            ...baseFcmData,
            ownerUserId: payload.ownerUserId,
            type: 'FAMILY_REMINDER',
          },
        }),
      ),
    );

    return [ownerNotification, ...relatedNotifications];
  }

  async createMedicationStockReminderNotifications(payload: CreateMedicationStockReminderPayload) {
    if (payload.stockCount > payload.lowStockThreshold) {
      return [];
    }

    const [ownerDisplayName, relatedUserIds] = await Promise.all([
      this.getUserDisplayName(payload.ownerUserId),
      this.getAcceptedRelatedUserIds(payload.ownerUserId),
    ]);

    const actionUrl = `/medicine/${payload.userMedicationId}/stock`;
    const baseFcmData = {
      userMedicationId: payload.userMedicationId,
      stockCount: payload.stockCount.toString(),
      lowStockThreshold: payload.lowStockThreshold.toString(),
    };

    const ownerNotification = await this.createMedicationStockReminderIfNotExists({
      userId: payload.ownerUserId,
      type: 'low_stock_reminder',
      title: 'Medication Stock Reminder',
      body: `${payload.medicationName} is running low (${payload.stockCount} left).`,
      scheduledFor: new Date(),
      iconType: 'medication',
      actionUrl,
      fcmData: {
        ...baseFcmData,
        type: 'LOW_STOCK',
      },
    });

    const relatedNotifications = await Promise.all(
      relatedUserIds.map((relatedUserId) =>
        this.createMedicationStockReminderIfNotExists({
          userId: relatedUserId,
          type: 'low_stock_reminder',
          title: 'Medication Stock Reminder',
          body: `${ownerDisplayName} is running low on ${payload.medicationName} (${payload.stockCount} left).`,
          scheduledFor: new Date(),
          iconType: 'medication',
          actionUrl,
          fcmData: {
            ...baseFcmData,
            ownerUserId: payload.ownerUserId,
            type: 'FAMILY_LOW_STOCK',
          },
        }),
      ),
    );

    return [ownerNotification, ...relatedNotifications];
  }

  async cancelPendingMedicationRemindersForUserMedication(userMedicationId: string) {
    const schedules = await this.prisma.reminderSchedule.findMany({
      where: { userMedicationId },
      select: { id: true },
    });

    if (schedules.length === 0) {
      return { count: 0 };
    }

    return this.prisma.notification.updateMany({
      where: {
        reminderScheduleId: { in: schedules.map((schedule) => schedule.id) },
        type: 'medication_reminder',
        deliveryStatus: 'pending',
      },
      data: {
        deliveryStatus: 'cancelled',
        failureReason: 'Medication reminder is disabled',
      },
    });
  }

  async registerDeviceToken(userId: string, dto: { token: string; platform: string }) {
    return await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      update: {
        userId,
        platform: dto.platform,
        isActive: true,
        lastUsedAt: new Date(),
      },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
        isActive: true,
      },
    });
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async createMedicationReminderIfNotExists(
    payload: MedicationReminderNotificationPayload,
  ): Promise<Notification> {
    const exists = await this.prisma.notification.findFirst({
      where: {
        userId: payload.userId,
        reminderScheduleId: payload.reminderScheduleId,
        type: payload.type,
        scheduledFor: payload.scheduledFor,
      },
    });

    if (exists) {
      return exists;
    }

    return this.createNotification(payload);
  }

  private async createMedicationStockReminderIfNotExists(
    payload: CreateNotificationPayload,
  ): Promise<Notification> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const exists = await this.prisma.notification.findFirst({
      where: {
        userId: payload.userId,
        type: payload.type,
        actionUrl: payload.actionUrl,
        deliveryStatus: { in: ['pending', 'sent'] },
        scheduledFor: { gte: oneDayAgo },
      },
    });

    if (exists) {
      return exists;
    }

    return this.createNotification(payload);
  }

  private async getAcceptedRelatedUserIds(userId: string) {
    const relationships = await this.prisma.userRelationship.findMany({
      where: {
        status: 'accepted',
        OR: [{ userId }, { relatedUserId: userId }],
      },
      select: {
        userId: true,
        relatedUserId: true,
      },
    });

    return [
      ...new Set(
        relationships
          .map((relationship) =>
            relationship.userId === userId ? relationship.relatedUserId : relationship.userId,
          )
          .filter((relatedUserId) => relatedUserId !== userId),
      ),
    ];
  }

  private async getUserDisplayName(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        username: true,
        profile: {
          select: {
            fullName: true,
          },
        },
      },
    });

    return user?.profile?.fullName || user?.username || user?.email || 'your family member';
  }

  private formatMedicationDose(dosage: string | null | undefined, medicationName: string) {
    return [dosage?.trim(), medicationName.trim()].filter(Boolean).join(' ');
  }

  /**
   * Send FCM push to all registered devices of a user
   */
  private async sendFcmToUserDevices(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId, isActive: true },
      select: { token: true },
    });

    if (!devices.length) return;

    const tokens = devices.map((d) => d.token);

    if (tokens.length === 1) {
      await this.fcmService
        .sendPush({ token: tokens[0], title, body, data })
        .catch((err: unknown) => this.logger.error(`FCM send failed for user ${userId}`, err));
    } else {
      await this.fcmService
        .sendMulticast(tokens, title, body, data)
        .catch((err: unknown) => this.logger.error(`FCM multicast failed for user ${userId}`, err));
    }
  }

  /**
   * Refresh unread badge count for user via WebSocket
   */
  private async refreshUnreadBadge(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    this.realtimeGateway.emitUnreadCountToUser(userId, unreadCount);
  }
}
