import { Module } from '@nestjs/common';
import { NotificationTimeSlotsService } from './notification-time-slots.service';
import { NotificationTimeSlotsController } from './notification-time-slots.controller';

@Module({
  controllers: [NotificationTimeSlotsController],
  providers: [NotificationTimeSlotsService],
  exports: [NotificationTimeSlotsService],
})
export class NotificationTimeSlotsModule {}
