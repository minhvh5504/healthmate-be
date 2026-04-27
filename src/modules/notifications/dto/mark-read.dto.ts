import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class MarkReadDto {
  @ApiPropertyOptional({ description: 'List of notification IDs to mark as read' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  ids?: string[];

  @ApiPropertyOptional({ description: 'Mark all notifications as read', default: false })
  @IsOptional()
  @IsBoolean()
  all?: boolean = false;
}
