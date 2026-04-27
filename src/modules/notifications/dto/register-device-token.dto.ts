import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn } from 'class-validator';

export class RegisterDeviceTokenDto {
  @ApiProperty({ description: 'FCM Device Token' })
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiProperty({ description: 'Platform', enum: ['ios', 'android'] })
  @IsNotEmpty()
  @IsString()
  @IsIn(['ios', 'android'])
  platform: string;
}
