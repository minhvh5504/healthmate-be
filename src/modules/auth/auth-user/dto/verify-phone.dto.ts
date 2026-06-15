import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, Length } from 'class-validator';

export class VerifyPhoneDto {
  @ApiProperty({
    example: '0901234567',
    description: 'Phone number to verify',
  })
  @IsString()
  @Matches(/^0[0-9]{9,10}$/, {
    message: 'Số điện thoại phải có 10-11 chữ số và bắt đầu bằng 0',
  })
  phone: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP code',
  })
  @IsString()
  @Length(6, 6, { message: 'OTP phải gồm đúng 6 chữ số' })
  @Matches(/^[0-9]{6}$/, { message: 'OTP chỉ được chứa chữ số' })
  otp: string;
}
