import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Temporary reset token received after verifying OTP',
  })
  @IsString({ message: 'Reset token phải là chuỗi' })
  @IsNotEmpty({ message: 'Vui lòng cung cấp reset token' })
  resetToken: string;

  @ApiProperty({
    example: 'Password123@',
    description: 'User password (min 6 characters)',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu mới' })
  @Length(6, 50, { message: 'Mật khẩu phải dài từ 6 đến 50 ký tự' })
  newPassword: string;
}
