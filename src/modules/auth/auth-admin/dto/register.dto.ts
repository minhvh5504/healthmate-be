import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminRegisterDto {
  @ApiProperty({
    example: 'admin@example.com',
    description: 'Email address of the admin',
  })
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @ApiProperty({
    example: 'Password123@',
    description: 'Admin password (min 6 characters)',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(50, { message: 'Password is too long' })
  password: string;
}
