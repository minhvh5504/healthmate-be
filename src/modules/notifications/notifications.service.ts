import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async findAll(userId: string, query: GetNotificationsDto) {
    const { isRead, type, limit = 20, page = 1 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { userId };
    if (isRead !== undefined) where.isRead = isRead;
    if (type) where.type = type;

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

  async findOne(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  async markAsRead(userId: string, id: string) {
    return await this.prisma.notification.update({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async remove(id: string, userId: string) {
    return await this.prisma.notification.delete({
      where: { id, userId },
    });
  }

  async removeAll(userId: string) {
    return await this.prisma.notification.deleteMany({
      where: { userId },
    });
  }

  /**
   * Internal method to create and emit a notification
   */
  async createNotification(data: {
    userId: string;
    type: string;
    title: string;
    body: string;
    iconType?: string;
    actionUrl?: string;
    scheduledFor?: Date;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        iconType: data.iconType || 'info',
        actionUrl: data.actionUrl,
        scheduledFor: data.scheduledFor || new Date(),
        deliveryStatus: 'sent',
        sentAt: new Date(),
      },
    });

    // Emit real-time notification
    this.realtimeGateway.emitNotification(data.userId, notification);

    return notification;
  }
}
