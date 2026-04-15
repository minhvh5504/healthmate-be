import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean } from 'class-validator';

export class CreateMedicationConditionDto {
  @ApiProperty({ description: 'Slug of the condition (e.g., hypertension, diabetes)' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ description: 'Display name of the condition' })
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiPropertyOptional({ description: 'Icon emoji for the condition' })
  @IsString()
  @IsOptional()
  iconEmoji?: string;

  @ApiPropertyOptional({ description: 'Sort order for display' })
  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether the condition is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
