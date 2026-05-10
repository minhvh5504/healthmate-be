import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({
    example: 'admin123',
    description: 'Admin username',
  })
  @IsString({ message: 'Username is required' })
  username: string;

  @ApiProperty({
    example: 'Password123@',
    description: 'Admin password',
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}
