import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsUUID, IsDateString } from 'class-validator';

export class CreateNotificationDto {
  @ApiPropertyOptional({ description: 'User ID (defaults to current user if not provided)' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ description: 'Notification type (e.g., REMINDER, SYSTEM)', example: 'SYSTEM' })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({ description: 'Notification title' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification body content' })
  @IsNotEmpty()
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: 'Icon type for UI', example: 'info' })
  @IsOptional()
  @IsString()
  iconType?: string;

  @ApiPropertyOptional({ description: 'Action URL for redirection' })
  @IsOptional()
  @IsString()
  actionUrl?: string;

  @ApiPropertyOptional({ description: 'Scheduled time for notification' })
  @IsOptional()
  @IsDateString()
  scheduledFor?: Date;
}
