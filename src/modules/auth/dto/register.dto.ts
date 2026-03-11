import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: '0901234567',
    description: 'Phone number (10-11 digits, Vietnamese format)',
  })
  @IsString()
  @Matches(/^0[0-9]{9,10}$/, {
    message: 'Phone number must be 10-11 digits and start with 0',
  })
  phone: string;

  @ApiProperty({
    example: 'Nguyễn Văn A',
    description: 'Full name of the user',
  })
  @IsString()
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  @MaxLength(100, { message: 'Full name is too long' })
  fullName: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'User password (min 6 characters)',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(50, { message: 'Password is too long' })
  password: string;
}
