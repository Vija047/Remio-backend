import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { validate } from './config/env.validation';
import { InsightsModule } from './insights/insights.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PredictionsModule } from './predictions/predictions.module';
import { PrismaModule } from './prisma/prisma.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { TaskCompletionsModule } from './task-completions/task-completions.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    UsersModule,
    AuthModule,
    TasksModule,
    TaskCompletionsModule,
    PredictionsModule,
    AiModule,
    NotificationsModule,
    InsightsModule,
    SubscriptionsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
