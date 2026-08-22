import {
  Body,
  Controller,
  Delete,
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

  @Get('history/all')
  @ApiOperation({ summary: 'Get all task completions for authenticated user' })
  allHistory(@CurrentUser() user: AuthUser) {
    return this.taskCompletionsService.allHistory(user.id);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark a task as completed and recalculate prediction' })
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteTaskDto,
  ) {
    return this.taskCompletionsService.complete(id, user.id, dto);
  }

  @Delete(':id/complete')
  @ApiOperation({ summary: 'Undo/delete the latest task completion and recalculate prediction' })
  uncomplete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.taskCompletionsService.uncomplete(id, user.id);
  }

  @Post(':id/uncomplete')
  @ApiOperation({ summary: 'Undo/delete the latest task completion and recalculate prediction (alias)' })
  uncompletePost(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.taskCompletionsService.uncomplete(id, user.id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get completion history for a single task' })
  history(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.taskCompletionsService.history(id, user.id);
  }
}

