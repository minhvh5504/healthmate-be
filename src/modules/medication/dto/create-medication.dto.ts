import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MaxLength, IsUrl } from 'class-validator';

export class CreateMedicationDto {
  @ApiProperty({ description: 'The name of the medication', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'The generic name of the medication', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  genericName?: string;

  @ApiPropertyOptional({ description: 'The form of the medication (e.g., tablet, capsule)', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  form?: string;

  @ApiPropertyOptional({ description: 'The strength of the medication (e.g., 500mg)', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  strength?: string;

  @ApiPropertyOptional({ description: 'The manufacturer of the medication', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  manufacturer?: string;

  @ApiPropertyOptional({ description: 'A description of the medication' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Image URL for the medication', maxLength: 500 })
  @IsOptional()
  @IsString()
  @IsUrl()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Whether the medication is verified', default: false })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}
