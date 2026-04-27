import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { Module } from '@nestjs/common';
import { NotificationSchedulerService } from './notification-scheduler.service';

@Module({
  imports: [RealtimeModule, FirebaseModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationSchedulerService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
