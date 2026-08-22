import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PredictionsModule } from '../predictions/predictions.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [NotificationsModule, PredictionsModule, SubscriptionsModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
