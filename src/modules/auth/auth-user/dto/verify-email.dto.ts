import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Định dạng email không hợp lệ' })
  email: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit verification code',
  })
  @IsString()
  @Length(6, 6, { message: 'Mã xác minh phải gồm 6 chữ số' })
  code: string;

  @ApiProperty({
    example: 'account',
    description: 'Type of verification (account or forgotpassword)',
    enum: ['account', 'forgotpassword'],
  })
  @IsString({ message: 'Type phải là account hoặc forgotpassword' })
  type: 'account' | 'forgotpassword';
}
