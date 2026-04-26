import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDate } from 'class-validator';
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
