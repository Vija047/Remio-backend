import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'Change water filter' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ example: 'Replace kitchen water filter' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 'home' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  category: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'reminderTime must be in HH:mm format',
  })
  reminderTime?: string;

  @ApiPropertyOptional({ example: '2026-05-15' })
  @IsOptional()
  @IsString()
  lastCompletedDate?: string;
}
