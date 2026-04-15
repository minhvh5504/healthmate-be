import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class UpdateMedicationLogDto {
  @ApiPropertyOptional({ description: 'Update the time taken' })
  @IsDateString()
  @IsOptional()
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
