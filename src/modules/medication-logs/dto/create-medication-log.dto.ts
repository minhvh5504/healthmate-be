import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDate, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export enum MedicationLogStatus {
  TAKEN = 'taken',
  MISSED = 'missed',
}

export class CreateMedicationLogDto {
  @ApiProperty({ description: 'ID of the user medication' })
  @IsString()
  @IsNotEmpty()
  userMedicationId: string;

  @ApiPropertyOptional({ description: 'ID of the reminder schedule' })
  @IsString()
  @IsOptional()
  reminderScheduleId?: string;

  @ApiPropertyOptional({ description: 'ID of the notification' })
  @IsString()
  @IsOptional()
  notificationId?: string;

  @ApiProperty({ description: 'Status (taken, missed)', enum: MedicationLogStatus })
  @IsEnum(MedicationLogStatus)
  @IsNotEmpty()
  status: MedicationLogStatus;

  @ApiPropertyOptional({ description: 'Time the medication was actually taken' })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  actualAt?: Date;

  @ApiPropertyOptional({ description: 'Quantity actually taken' })
  @IsInt()
  @IsOptional()
  actualQuantity?: number;

  @ApiPropertyOptional({ description: 'Meal instruction snapshot (e.g., before_meal)' })
  @IsString()
  @IsOptional()
  mealInstruction?: string;
}
