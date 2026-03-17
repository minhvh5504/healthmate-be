import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Temporary reset token received after verifying OTP',
  })
  @IsString({ message: 'Reset token must be a string' })
  @IsNotEmpty({ message: 'Reset token is required' })
  resetToken: string;

  @ApiProperty({
    example: 'NewPassword123!',
    description: 'New password (min 6 characters)',
  })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @Length(6, 50, { message: 'Password must be between 6 and 50 characters' })
  newPassword: string;
}
