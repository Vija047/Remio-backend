import { Module } from '@nestjs/common';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [SubscriptionsModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
