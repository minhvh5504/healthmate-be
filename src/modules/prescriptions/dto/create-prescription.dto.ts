import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrescriptionStatus } from '@prisma/client';

export class CreatePrescriptionDto {
  @ApiPropertyOptional({ description: 'Doctor name' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  doctorName?: string;

  @ApiPropertyOptional({ description: 'Clinic name' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  clinicName?: string;

  @ApiPropertyOptional({ description: 'Prescription image URL. Optional when uploading file.' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Cloudinary public ID of the prescription image' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  imagePublicId?: string;

  @ApiProperty({ description: 'Prescription start date', example: '2026-06-19' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: 'Prescription end date', example: '2026-06-30' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Additional note' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ enum: PrescriptionStatus, default: PrescriptionStatus.ACTIVE })
  @IsEnum(PrescriptionStatus)
  @IsOptional()
  status?: PrescriptionStatus;
}
