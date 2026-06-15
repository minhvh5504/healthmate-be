import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'OldPassword123@',
    description: 'Current password of the user',
  })
  @IsString({ message: 'Mật khẩu hiện tại phải là chuỗi' })
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu hiện tại' })
  currentPassword: string;

  @ApiProperty({
    example: 'NewPassword123@',
    description: 'New password (min 6, max 50 characters)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu mới' })
  @Length(6, 50, { message: 'Mật khẩu mới phải dài từ 6 đến 50 ký tự' })
  newPassword: string;
}
