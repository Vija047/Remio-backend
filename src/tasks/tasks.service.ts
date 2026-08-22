import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationScheduler } from '../notifications/notifications.service';
import { PredictionsService } from '../predictions/predictions.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationScheduler: NotificationScheduler,
    private readonly predictionsService: PredictionsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  findAll(userId: string) {
    return this.prisma.task.findMany({
      where: { userId },
      include: {
        prediction: true,
        completions: {
          orderBy: { completedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      include: {
        prediction: true,
        completions: {
          orderBy: { completedAt: 'desc' },
        },
      },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async create(userId: string, dto: CreateTaskDto) {
    const isPro = await this.subscriptionsService.hasActiveProAccess(userId);
    if (!isPro) {
      const activeCount = await this.prisma.task.count({
        where: { userId, isActive: true },
      });
      if (activeCount >= 5) {
        throw new ForbiddenException(
          'Free plan is limited to 5 active routines. Upgrade to Pro for unlimited routines.',
        );
      }
    }

    const task = await this.prisma.task.create({
      data: {
        userId,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        category: dto.category.trim(),
        reminderEnabled: dto.reminderEnabled ?? false,
        reminderTime: dto.reminderTime,
      },
    });

    if (dto.lastCompletedDate) {
      const parsedDate = new Date(dto.lastCompletedDate);
      if (!isNaN(parsedDate.getTime())) {
        await this.prisma.taskCompletion.create({
          data: {
            taskId: task.id,
            completedAt: parsedDate,
            notes: 'Initial recorded completion',
          },
        });
        await this.predictionsService.recalculateForTask(task.id).catch(() => {});
      }
    }

    if (task.reminderEnabled) {
      const scheduledFor = new Date();
      scheduledFor.setDate(scheduledFor.getDate() + 1);
      if (dto.reminderTime) {
        const [h, m] = dto.reminderTime.split(':');
        scheduledFor.setHours(parseInt(h, 10) || 9, parseInt(m, 10) || 0, 0, 0);
      }
      await this.notificationScheduler
        .schedule({
          userId,
          taskId: task.id,
          notificationType: 'prediction_reminder',
          scheduledFor,
        })
        .catch(() => {});
    }

    return this.findOne(task.id, userId);
  }

  async update(id: string, userId: string, dto: UpdateTaskDto) {
    await this.findOne(id, userId);
    return this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        category: dto.category?.trim(),
        isActive: dto.isActive,
        reminderEnabled: dto.reminderEnabled,
        reminderTime: dto.reminderTime,
      },
      include: {
        prediction: true,
        completions: {
          orderBy: { completedAt: 'desc' },
        },
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.task.delete({ where: { id } });
    return { message: 'Task deleted' };
  }
}
