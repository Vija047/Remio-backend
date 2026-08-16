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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { CompleteTaskDto } from './dto/complete-task.dto';
import { TaskCompletionsService } from './task-completions.service';

@ApiTags('task-completions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TaskCompletionsController {
  constructor(
    private readonly taskCompletionsService: TaskCompletionsService,
  ) {}

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark a task as completed and recalculate prediction' })
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteTaskDto,
  ) {
    return this.taskCompletionsService.complete(id, user.id, dto);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get completion history for a task' })
  history(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.taskCompletionsService.history(id, user.id);
  }
}
