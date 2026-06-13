import { Module } from '@nestjs/common';
import { UserMedicationService } from './user-medication.service';
import { UserMedicationController } from './user-medication.controller';
import { UploadModule } from '../upload/upload.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule, UploadModule],
  controllers: [UserMedicationController],
  providers: [UserMedicationService],
  exports: [UserMedicationService],
})
export class UserMedicationModule {}
