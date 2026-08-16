import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import {
  NotificationScheduler,
  NotificationsService,
} from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationScheduler],
  exports: [NotificationsService, NotificationScheduler],
})
export class NotificationsModule {}
