import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    example: 'patient@healthmate.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit verification code',
  })
  @IsString()
  @Length(6, 6, { message: 'Verification code must be 6 digits' })
  code: string;

  @ApiProperty({
    example: '0901234567',
    description: 'Optional phone number',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;
}
