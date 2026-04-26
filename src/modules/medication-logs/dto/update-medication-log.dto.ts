import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDate, IsEnum, IsInt } from 'class-validator';
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
  actualAt?: Date;

  @ApiPropertyOptional({ description: 'Update the quantity taken' })
  @IsInt()
  @IsOptional()
  actualQuantity?: number;

  @ApiPropertyOptional({ description: 'Update the meal instruction snapshot' })
  @IsString()
  @IsOptional()
  mealInstruction?: string;
}
