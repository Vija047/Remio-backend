import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ example: 'alex.google@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: 'Alex Smith' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '1098237461982736412' })
  @IsOptional()
  @IsString()
  googleId?: string;

  @ApiPropertyOptional({ example: 'eyJhbGciOiJSUzI1NiIs...' })
  @IsOptional()
  @IsString()
  idToken?: string;

  @ApiPropertyOptional({ example: 'https://lh3.googleusercontent.com/a/...' })
  @IsOptional()
  @IsString()
  photoUrl?: string;
}
