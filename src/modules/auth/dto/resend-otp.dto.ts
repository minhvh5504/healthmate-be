import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ResendOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address to resend OTP',
  })
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @ApiProperty({
    example: '0901234567',
    description: 'Optional phone number',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;
}
