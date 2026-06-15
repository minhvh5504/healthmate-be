import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  IsArray,
  Matches,
} from 'class-validator';

export class CreateReminderScheduleDto {
  @ApiProperty({ description: 'ID of the user medication' })
  @IsString()
  @IsNotEmpty()
  userMedicationId: string;

  @ApiPropertyOptional({ description: 'Time to remind (HH:mm)', example: '08:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'remindTime phải có định dạng HH:mm' })
  remindTime?: string;

  @ApiPropertyOptional({
    description: 'Type of repeat (daily, weekly, interval)',
    default: 'daily',
  })
  @IsString()
  @IsOptional()
  repeatType?: string;

  @ApiPropertyOptional({
    description: 'Days of week to repeat (0-6 for Mon-Sun)',
    example: [0, 2, 4],
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  repeatDays?: number[];

  @ApiPropertyOptional({ description: 'Interval in days for repeat' })
  @IsInt()
  @IsOptional()
  repeatInterval?: number;

  @ApiPropertyOptional({ description: 'Whether the schedule is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
