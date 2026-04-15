import { Module } from '@nestjs/common';
import { MedicationConditionsService } from './medication-conditions.service';
import { MedicationConditionsController } from './medication-conditions.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MedicationConditionsController],
  providers: [MedicationConditionsService],
  exports: [MedicationConditionsService],
})
export class MedicationConditionsModule {}
