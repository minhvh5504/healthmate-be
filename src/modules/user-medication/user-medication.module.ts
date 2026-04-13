import { Module } from '@nestjs/common';
import { UserMedicationService } from './user-medication.service';
import { UserMedicationController } from './user-medication.controller';

@Module({
  controllers: [UserMedicationController],
  providers: [UserMedicationService],
  exports: [UserMedicationService],
})
export class UserMedicationModule {}
