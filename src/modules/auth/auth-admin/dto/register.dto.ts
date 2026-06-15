import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AdminRegisterDto {
  @ApiProperty({
    example: 'admin123',
    description: 'Username of the admin',
  })
  @IsString({ message: 'Tên đăng nhập phải là chuỗi' })
  @MinLength(3, { message: 'Tên đăng nhập phải có ít nhất 3 ký tự' })
  @MaxLength(50, { message: 'Tên đăng nhập quá dài' })
  username: string;

  @ApiProperty({
    example: 'Password123@',
    description: 'Admin password (min 6 characters)',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  @MaxLength(50, { message: 'Mật khẩu quá dài' })
  password: string;
}
