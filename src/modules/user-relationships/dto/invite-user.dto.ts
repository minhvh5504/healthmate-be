import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class InviteUserDto {
  @ApiProperty({ example: 'family@example.com', description: 'Email of the user to invite' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
