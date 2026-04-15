import { PartialType } from '@nestjs/swagger';
import { CreateReminderScheduleDto } from './create-reminder-schedule.dto';

export class UpdateReminderScheduleDto extends PartialType(CreateReminderScheduleDto) {}
