import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class ScanMedicationDto {
  @ApiProperty({ description: 'Text extracted from MLKit OCR (usually Medication Name)' })
  @IsString()
  @IsNotEmpty()
  scannedText: string;

  @ApiPropertyOptional({ description: 'Detected shape or form (e.g. tablet, capsule, vi, lo)' })
  @IsString()
  @IsOptional()
  shape?: string;

  @ApiPropertyOptional({ description: 'Raw scanned data from OCR to be saved for reference' })
  @IsOptional()
  rawScannedData?: unknown;
}
