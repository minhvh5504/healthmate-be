import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CreateNotificationTimeSlotDto {
  @ApiProperty({ example: 'before_breakfast' })
  @IsNotEmpty()
  @IsString()
  @Length(1, 30)
  slug: string;

  @ApiProperty({ example: 'Trước bữa sáng' })
  @IsNotEmpty()
  @IsString()
  @Length(1, 50)
  displayName: string;

  @ApiProperty({ example: '07:00' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):?([0-5]\d)$/, {
    message: 'defaultTime must be in HH:mm format',
  })
  defaultTime: string;
}
