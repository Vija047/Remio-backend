import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { AiService } from './ai.service';
import { ParseTaskDto } from './dto/parse-task.dto';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('parse-task')
  @ApiOperation({ summary: 'Parse natural language into a structured task' })
  parseTask(@Body() dto: ParseTaskDto) {
    return this.aiService.parseTask(dto.text);
  }

  @Get('routine-coach')
  @ApiOperation({ summary: 'Get AI routine coaching recommendations' })
  routineCoach(@CurrentUser() user: AuthUser) {
    return this.aiService.routineCoach(user.id);
  }
}

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('tasks')
export class AiPreparationController {
  constructor(private readonly aiService: AiService) {}

  @Get(':id/preparation')
  @ApiOperation({ summary: 'Get AI preparation suggestion for a task' })
  preparation(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.aiService.preparation(id, user.id);
  }
}
