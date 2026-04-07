import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationTimeSlotDto } from './dto/update-notification-time-slot.dto';
import { CreateNotificationTimeSlotDto } from './dto/create-notification-time-slot.dto';

@Injectable()
export class NotificationTimeSlotsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.notificationTimeSlot.findMany({
      orderBy: { defaultTime: 'asc' },
    });
  }

  async findOne(id: string) {
    const slot = await this.prisma.notificationTimeSlot.findUnique({
      where: { id },
    });
    if (!slot) {
      throw new NotFoundException(`Notification time slot not found`);
    }
    return slot;
  }

  async update(id: string, updateDto: UpdateNotificationTimeSlotDto) {
    await this.findOne(id);
    return this.prisma.notificationTimeSlot.update({
      where: { id },
      data: updateDto,
    });
  }

  async create(createDto: CreateNotificationTimeSlotDto) {
    return this.prisma.notificationTimeSlot.create({
      data: createDto,
    });
  }
}
