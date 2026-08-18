import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

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
      }
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
