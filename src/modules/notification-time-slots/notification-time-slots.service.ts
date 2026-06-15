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
      'Lấy danh sách khung giờ thông báo thành công',
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
        'Không tìm thấy khung giờ thông báo',
        404,
      );
    }
    return ResponseHelper.success(
      slot,
      MessageCodes.NOTIFICATION_TIME_SLOT_RETRIEVED,
      'Lấy khung giờ thông báo thành công',
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
      'Cập nhật khung giờ thông báo thành công',
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
      'Tạo khung giờ thông báo thành công',
      201,
    );
  }
}
