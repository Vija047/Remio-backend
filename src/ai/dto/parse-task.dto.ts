import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class ParseTaskDto {
  @ApiProperty({
    example: 'Remind me to change my water filter every three months',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  text: string;
}
