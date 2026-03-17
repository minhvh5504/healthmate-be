import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleOAuthDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjI3...',
    description: 'Google ID token from frontend',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
