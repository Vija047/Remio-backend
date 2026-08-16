import { Module } from '@nestjs/common';
import { PredictionsModule } from '../predictions/predictions.module';
import { TaskCompletionsController } from './task-completions.controller';
import { TaskCompletionsService } from './task-completions.service';

@Module({
  imports: [PredictionsModule],
  controllers: [TaskCompletionsController],
  providers: [TaskCompletionsService],
})
export class TaskCompletionsModule {}
