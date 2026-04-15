import { Module } from '@nestjs/common';
import { MedicationLogsService } from './medication-logs.service';
import { MedicationLogsController } from './medication-logs.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MedicationLogsController],
  providers: [MedicationLogsService],
  exports: [MedicationLogsService],
})
export class MedicationLogsModule {}
