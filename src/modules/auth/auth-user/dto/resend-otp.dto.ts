import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ResendOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address to resend OTP',
  })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({
    example: 'account',
    description: 'Type of verification (account or forgotpassword)',
    enum: ['account', 'forgotpassword'],
  })
  @IsString({ message: 'Type phải là account hoặc forgotpassword' })
  type: 'account' | 'forgotpassword';
}
