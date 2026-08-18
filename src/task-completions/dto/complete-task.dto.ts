import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteTaskDto {
  @ApiPropertyOptional({ example: 'Replaced the filter' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ example: '2026-05-18T10:00:00.000Z' })
  @IsOptional()
  @IsString()
  completedAt?: string;
}
