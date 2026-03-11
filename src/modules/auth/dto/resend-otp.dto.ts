import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ResendOtpDto {
  @ApiProperty({
    example: '0901234567',
    description: 'Phone number to resend OTP',
  })
  @IsString()
  @Matches(/^0[0-9]{9,10}$/, {
    message: 'Phone number must be 10-11 digits and start with 0',
  })
  phone: string;
}
