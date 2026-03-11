import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, Length } from 'class-validator';

export class VerifyPhoneDto {
  @ApiProperty({
    example: '0901234567',
    description: 'Phone number to verify',
  })
  @IsString()
  @Matches(/^0[0-9]{9,10}$/, {
    message: 'Phone number must be 10-11 digits and start with 0',
  })
  phone: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP code',
  })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^[0-9]{6}$/, { message: 'OTP must contain only digits' })
  otp: string;
}
