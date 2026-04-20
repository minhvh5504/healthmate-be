import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleItemDto {
  @ApiProperty({ description: 'Time string HH:mm' })
  @IsString()
  time: string;

  @ApiProperty({ description: 'Number of doses at this time slot' })
  @IsNumber()
  doses: number;
}

export class CreateUserMedicationDto {
  @ApiProperty({ description: 'ID of the medication' })
  @IsString()
  @IsNotEmpty()
  medicationId: string;

  @ApiPropertyOptional({ description: 'Specific dosage like 1 pill, 500mg' })
  @IsString()
  @IsOptional()
  dosage?: string;

  @ApiPropertyOptional({ description: 'Meal instructions (before, after, with meals)' })
  @IsString()
  @IsOptional()
  mealInstruction?: string;

  @ApiPropertyOptional({ description: 'Any extra notes about meal instructions' })
  @IsString()
  @IsOptional()
  mealInstructionNote?: string;

  @ApiPropertyOptional({ description: 'ID of condition treated' })
  @IsString()
  @IsOptional()
  conditionId?: string;

  @ApiPropertyOptional({ description: 'Custom condition text if conditionId not provided' })
  @IsString()
  @IsOptional()
  conditionCustom?: string;

  @ApiPropertyOptional({ description: 'Whether reminder is enabled', default: true })
  @IsBoolean()
  @IsOptional()
  reminderEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Whether the medication is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Start date to take medication' })
  @IsOptional()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date to take medication' })
  @IsOptional()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Number of items currently in stock' })
  @IsInt()
  @IsOptional()
  stockCount?: number;

  @ApiPropertyOptional({ description: 'Threshold to send low stock notification', default: 5 })
  @IsInt()
  @IsOptional()
  lowStockThreshold?: number;

  @ApiPropertyOptional({ description: 'Used to store extra info like OCR text' })
  @IsOptional()
  scannedData?: any;

  @ApiPropertyOptional({ description: 'Enable low stock reminder' })
  @IsBoolean()
  @IsOptional()
  lowStockReminderEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Frequency: daily, specific_days, as_needed' })
  @IsString()
  @IsOptional()
  frequency?: string;

  @ApiPropertyOptional({ description: 'Days of week to repeat (0-6 for Mon-Sun)' })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  selectedDays?: number[];

  @ApiPropertyOptional({
    description: 'List of time slots for taking medication',
    type: [ScheduleItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleItemDto)
  schedules?: ScheduleItemDto[];
}
