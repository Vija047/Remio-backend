import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import {
  NotificationScheduler,
  NotificationsService,
} from './notifications.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [SubscriptionsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationScheduler],
  exports: [NotificationsService, NotificationScheduler],
})
export class NotificationsModule {}
