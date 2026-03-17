import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class AdminResendOtpDto {
  @ApiProperty({
    example: 'admin@healthmate.com',
    description: 'Email address to resend OTP',
  })
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @ApiProperty({
    example: 'account',
    description: 'Type of verification (account)',
    enum: ['account'],
  })
  @IsString({ message: 'Type must be account' })
  type: 'account';
}
