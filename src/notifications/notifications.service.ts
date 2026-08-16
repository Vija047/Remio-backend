import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationType =
  | 'prediction_reminder'
  | 'preparation_reminder'
  | 'overdue_reminder';

@Injectable()
export class NotificationScheduler {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * MVP abstraction for scheduling notifications.
   * Expo push delivery can be wired later without changing callers.
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

  // Placeholder for future Expo push integration.
  async dispatchPending(): Promise<number> {
    return 0;
  }
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
