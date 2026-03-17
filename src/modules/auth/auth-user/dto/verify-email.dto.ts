import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    example: 'user@example.com',
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
    example: 'account',
    description: 'Type of verification (account or forgotpassword)',
    enum: ['account', 'forgotpassword'],
  })
  @IsString({ message: 'Type must be account or forgotpassword' })
  type: 'account' | 'forgotpassword';
}
