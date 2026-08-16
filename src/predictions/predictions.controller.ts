import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { PredictionsService } from './predictions.service';

@ApiTags('predictions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Get(':id/prediction')
  @ApiOperation({ summary: 'Get prediction for a task' })
  getPrediction(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.predictionsService.getForTask(id, user.id);
  }
}
