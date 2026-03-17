import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'joyhn@example.com',
    description: 'Email address of the user',
  })
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'User password (min 6 characters)',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(50, { message: 'Password is too long' })
  password: string;

  @ApiProperty({
    example: '0901234567',
    description: 'Optional phone number',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;
}
