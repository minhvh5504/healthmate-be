import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'OldPassword123!',
    description: 'Current password of the user',
  })
  @IsString({ message: 'Current password must be a string' })
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @ApiProperty({
    example: 'NewPassword123!',
    description: 'New password (min 6, max 50 characters)',
  })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @Length(6, 50, { message: 'New password must be between 6 and 50 characters' })
  newPassword: string;
}
