import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateNotificationTimeSlotDto {
  @ApiPropertyOptional({ example: 'Sau bữa sáng' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  displayName?: string;

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):?([0-5]\d)$/, {
    message: 'defaultTime must be in HH:mm format',
  })
  defaultTime?: string;
}
