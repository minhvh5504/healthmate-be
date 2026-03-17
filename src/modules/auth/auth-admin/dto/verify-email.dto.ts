import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class AdminVerifyEmailDto {
  @ApiProperty({
    example: 'admin@healthmate.com',
    description: 'Admin email address',
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
    description: 'Type of verification (account)',
    enum: ['account'],
  })
  @IsString({ message: 'Type must be account' })
  type: 'account';
}
