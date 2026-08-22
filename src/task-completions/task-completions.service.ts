import { Injectable, NotFoundException } from '@nestjs/common';
import { PredictionsService } from '../predictions/predictions.service';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteTaskDto } from './dto/complete-task.dto';

@Injectable()
export class TaskCompletionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly predictionsService: PredictionsService,
  ) {}

  async complete(taskId: string, userId: string, dto: CompleteTaskDto) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const completionDate = dto.completedAt ? new Date(dto.completedAt) : new Date();
    const validCompletionDate = isNaN(completionDate.getTime()) ? new Date() : completionDate;

    // 5-second idempotency guard to prevent duplicate entries on rapid double-taps
    const latestCompletion = await this.prisma.taskCompletion.findFirst({
      where: { taskId },
      orderBy: { completedAt: 'desc' },
    });

    if (latestCompletion) {
      const diffMs = Math.abs(validCompletionDate.getTime() - latestCompletion.completedAt.getTime());
      if (diffMs < 5000) {
        const existingPrediction = await this.prisma.prediction.findUnique({
          where: { taskId },
        });
        return {
          completion: {
            id: latestCompletion.id,
            completedAt: latestCompletion.completedAt,
            notes: latestCompletion.notes,
          },
          prediction:
            !existingPrediction
              ? {
                  status: 'learning',
                  message:
                    'Complete this task a few more times so RoutineAI can learn your routine.',
                  confidenceScore: 0,
                }
              : {
                  predictedDate: existingPrediction.predictedDate,
                  minDays: existingPrediction.minDays,
                  maxDays: existingPrediction.maxDays,
                  confidenceScore: Number(existingPrediction.confidenceScore),
                  bestDay: existingPrediction.bestDay,
                  averageIntervalDays: Number(existingPrediction.averageIntervalDays),
                },
        };
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const completion = await tx.taskCompletion.create({
        data: {
          taskId,
          notes: dto.notes?.trim(),
          completedAt: validCompletionDate,
        },
      });

      const prediction = await this.predictionsService.recalculateForTask(
        taskId,
        tx,
      );

      return {
        completion: {
          id: completion.id,
          completedAt: completion.completedAt,
          notes: completion.notes,
        },
        prediction:
          !prediction || prediction.status === 'learning'
            ? {
                status: 'learning',
                message:
                  prediction?.message ??
                  'Complete this task a few more times so RoutineAI can learn your routine.',
                confidenceScore: 0,
              }
            : {
                predictedDate: prediction.predictedDate,
                minDays: prediction.minDays,
                maxDays: prediction.maxDays,
                confidenceScore: prediction.confidenceScore,
                bestDay: prediction.bestDay,
                averageIntervalDays: prediction.averageIntervalDays,
              },
      };
    });
  }

  async history(taskId: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.prisma.taskCompletion.findMany({
      where: { taskId },
      orderBy: { completedAt: 'desc' },
    });
  }

  async allHistory(userId: string) {
    return this.prisma.taskCompletion.findMany({
      where: {
        task: {
          userId,
        },
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            category: true,
            prediction: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });
  }

  async uncomplete(taskId: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const latestCompletion = await this.prisma.taskCompletion.findFirst({
      where: { taskId },
      orderBy: { completedAt: 'desc' },
    });

    if (!latestCompletion) {
      return { message: 'No completion history found to undo.' };
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.taskCompletion.delete({
        where: { id: latestCompletion.id },
      });

      const prediction = await this.predictionsService.recalculateForTask(
        taskId,
        tx,
      );

      return {
        message: 'Completion undone successfully',
        prediction:
          !prediction || prediction.status === 'learning'
            ? {
                status: 'learning',
                message:
                  prediction?.message ??
                  'Complete this task a few more times so RoutineAI can learn your routine.',
                confidenceScore: 0,
              }
            : {
                predictedDate: prediction.predictedDate,
                minDays: prediction.minDays,
                maxDays: prediction.maxDays,
                confidenceScore: prediction.confidenceScore,
                bestDay: prediction.bestDay,
                averageIntervalDays: prediction.averageIntervalDays,
              },
      };
    });
  }
}

