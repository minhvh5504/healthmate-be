import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class DeleteNotificationDto {
  @ApiPropertyOptional({ description: 'List of notification IDs to delete' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  ids?: string[];

  @ApiPropertyOptional({ description: 'Delete all notifications', default: false })
  @IsOptional()
  @IsBoolean()
  all?: boolean = false;
}
