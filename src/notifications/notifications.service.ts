import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationType =
  | 'prediction_reminder'
  | 'preparation_reminder'
  | 'overdue_reminder';

@Injectable()
export class NotificationScheduler {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Schedules a notification record in database.
   */
  async schedule(input: {
    userId: string;
    taskId: string;
    notificationType: NotificationType;
    scheduledFor: Date;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        taskId: input.taskId,
        notificationType: input.notificationType,
        scheduledFor: input.scheduledFor,
        status: 'pending',
      },
    });
  }

  /**
   * Dispatches pending notifications whose scheduled time has arrived via Expo Push API.
   */
  async dispatchPending(): Promise<number> {
    const now = new Date();
    const pending = await this.prisma.notification.findMany({
      where: {
        status: 'pending',
        scheduledFor: { lte: now },
      },
      include: {
        user: {
          include: { settings: true },
        },
        task: {
          select: { id: true, title: true, category: true },
        },
      },
      take: 50,
    });

    if (pending.length === 0) return 0;

    let dispatchedCount = 0;
    const messages: any[] = [];
    const notificationIds: string[] = [];

    for (const notif of pending) {
      const pushToken = notif.user?.settings?.pushToken;
      if (pushToken && pushToken.startsWith('ExponentPushToken')) {
        messages.push({
          to: pushToken,
          sound: 'default',
          title: `🎯 Routine Due: ${notif.task.title}`,
          body: `It's time for your ${notif.task.title} routine. Tap to check it off!`,
          data: { taskId: notif.task.id, type: notif.notificationType },
        });
      }
      notificationIds.push(notif.id);
    }

    if (messages.length > 0) {
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        });
      } catch (err) {
        console.warn('Expo Push dispatch failed:', err);
      }
    }

    if (notificationIds.length > 0) {
      await this.prisma.notification.updateMany({
        where: { id: { in: notificationIds } },
        data: { status: 'sent', sentAt: now },
      });
      dispatchedCount = notificationIds.length;
    }

    return dispatchedCount;
  }
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: NotificationScheduler,
  ) {}

  async savePushToken(userId: string, pushToken: string) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        pushToken,
      },
      update: {
        pushToken,
      },
    });
  }

  async dispatchPending() {
    return this.scheduler.dispatchPending();
  }

  findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { scheduledFor: 'desc' },
    });
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { status: 'read' },
    });
  }

  async createTestNotification(userId: string) {
    const task = await this.prisma.task.findFirst({
      where: { userId },
    });

    if (!task) {
      return { message: 'No active routines found for user. Please create a routine first.' };
    }

    return this.prisma.notification.create({
      data: {
        userId,
        taskId: task.id,
        notificationType: 'prediction_reminder',
        scheduledFor: new Date(),
        status: 'pending',
      },
      include: {
        task: {
          select: { title: true },
        },
      },
    });
  }
}
