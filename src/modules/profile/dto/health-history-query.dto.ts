import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum HealthHistoryMetric {
  weight = 'weight',
  height = 'height',
}

export enum HealthHistoryPeriod {
  day = 'day',
  week = 'week',
  month = 'month',
}

export class HealthHistoryQueryDto {
  @ApiPropertyOptional({ enum: HealthHistoryMetric, default: HealthHistoryMetric.weight })
  @IsOptional()
  @IsEnum(HealthHistoryMetric)
  metric?: HealthHistoryMetric;

  @ApiPropertyOptional({ enum: HealthHistoryPeriod, default: HealthHistoryPeriod.day })
  @IsOptional()
  @IsEnum(HealthHistoryPeriod)
  period?: HealthHistoryPeriod;

  @ApiPropertyOptional({ description: 'Reference date in YYYY-MM-DD format' })
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class HealthHistoryChangesQueryDto {
  @ApiPropertyOptional({ enum: HealthHistoryMetric, default: HealthHistoryMetric.weight })
  @IsOptional()
  @IsEnum(HealthHistoryMetric)
  metric?: HealthHistoryMetric;

  @ApiPropertyOptional({ enum: HealthHistoryPeriod, default: HealthHistoryPeriod.day })
  @IsOptional()
  @IsEnum(HealthHistoryPeriod)
  period?: HealthHistoryPeriod;

  @ApiPropertyOptional({ description: 'Reference date in YYYY-MM-DD format' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
