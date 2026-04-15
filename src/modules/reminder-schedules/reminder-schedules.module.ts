import { Module } from '@nestjs/common';
import { ReminderSchedulesService } from './reminder-schedules.service';
import { ReminderSchedulesController } from './reminder-schedules.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReminderSchedulesController],
  providers: [ReminderSchedulesService],
  exports: [ReminderSchedulesService],
})
export class ReminderSchedulesModule {}
