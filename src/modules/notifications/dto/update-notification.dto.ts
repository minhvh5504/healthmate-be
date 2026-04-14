import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateNotificationDto {
  @ApiProperty({ description: 'Mark notification as read/unread' })
  @IsBoolean()
  isRead: boolean;
}
