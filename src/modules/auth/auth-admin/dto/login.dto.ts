import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({
    example: 'admin123',
    description: 'Admin username',
  })
  @IsString({ message: 'Vui lòng nhập tên đăng nhập' })
  username: string;

  @ApiProperty({
    example: 'Password123@',
    description: 'Admin password',
  })
  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;
}
