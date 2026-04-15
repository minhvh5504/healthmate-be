import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString } from 'class-validator';

export enum MedicationLogStatus {
  TAKEN = 'taken',
  MISSED = 'missed',
  SKIPPED = 'skipped',
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

  @ApiProperty({ description: 'Status (taken, missed, skipped)', enum: MedicationLogStatus })
  @IsEnum(MedicationLogStatus)
  @IsNotEmpty()
  status: string;

  @ApiPropertyOptional({ description: 'Time the medication was actually taken' })
  @IsDateString()
  @IsOptional()
  takenAt?: Date;

  @ApiPropertyOptional({ description: 'Dosage taken if different from default' })
  @IsString()
  @IsOptional()
  dosageTaken?: string;

  @ApiPropertyOptional({ description: 'Any extra notes' })
  @IsString()
  @IsOptional()
  note?: string;
}
