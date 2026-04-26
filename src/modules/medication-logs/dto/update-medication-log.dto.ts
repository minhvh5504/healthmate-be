import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDate, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { MedicationLogStatus } from './create-medication-log.dto';

export class UpdateMedicationLogDto {
  @ApiPropertyOptional({ description: 'Update status', enum: MedicationLogStatus })
  @IsEnum(MedicationLogStatus)
  @IsOptional()
  status?: MedicationLogStatus;

  @ApiPropertyOptional({ description: 'Update the time taken' })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  takenAt?: Date;

  @ApiPropertyOptional({ description: 'Update the dosage taken' })
  @IsString()
  @IsOptional()
  dosageTaken?: string;

  @ApiPropertyOptional({ description: 'Update notes' })
  @IsString()
  @IsOptional()
  note?: string;
}
