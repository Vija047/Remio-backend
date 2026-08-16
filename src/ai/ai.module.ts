import { Module } from '@nestjs/common';
import { PredictionsModule } from '../predictions/predictions.module';
import { AiController, AiPreparationController } from './ai.controller';
import { AiService } from './ai.service';
import { OpenRouterService } from './openrouter.service';

@Module({
  imports: [PredictionsModule],
  controllers: [AiController, AiPreparationController],
  providers: [AiService, OpenRouterService],
  exports: [AiService, OpenRouterService],
})
export class AiModule {}
