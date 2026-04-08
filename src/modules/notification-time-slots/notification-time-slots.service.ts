import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationTimeSlotDto } from './dto/update-notification-time-slot.dto';
import { CreateNotificationTimeSlotDto } from './dto/create-notification-time-slot.dto';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';

@Injectable()
export class NotificationTimeSlotsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all notification time slots
   */
  async findAll() {
    const slots = await this.prisma.notificationTimeSlot.findMany({
      orderBy: { defaultTime: 'asc' },
    });
    return ResponseHelper.success(
      slots,
      MessageCodes.NOTIFICATION_TIME_SLOT_LIST_RETRIEVED,
      'Notification time slots retrieved successfully',
    );
  }

  /**
   * Get notification time slot by id
   */
  async findOne(id: string) {
    const slot = await this.prisma.notificationTimeSlot.findUnique({
      where: { id },
    });
    if (!slot) {
      throw new ApiException(
        MessageCodes.NOTIFICATION_TIME_SLOT_NOT_FOUND,
        'Notification time slot not found',
        404,
      );
    }
    return ResponseHelper.success(
      slot,
      MessageCodes.NOTIFICATION_TIME_SLOT_RETRIEVED,
      'Notification time slot retrieved successfully',
    );
  }

  /**
   * Update notification time slot
   */
  async update(id: string, updateDto: UpdateNotificationTimeSlotDto) {
    await this.findOne(id);
    const updated = await this.prisma.notificationTimeSlot.update({
      where: { id },
      data: updateDto,
    });
    return ResponseHelper.success(
      updated,
      MessageCodes.NOTIFICATION_TIME_SLOT_UPDATED,
      'Notification time slot updated successfully',
    );
  }

  /**
   * Create notification time slot
   */
  async create(createDto: CreateNotificationTimeSlotDto) {
    const created = await this.prisma.notificationTimeSlot.create({
      data: createDto,
    });
    return ResponseHelper.success(
      created,
      MessageCodes.NOTIFICATION_TIME_SLOT_CREATED,
      'Notification time slot created successfully',
      201,
    );
  }
}
