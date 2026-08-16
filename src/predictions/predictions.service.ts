import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PredictionEngine, PredictionResult } from './prediction.engine';

@Injectable()
export class PredictionsService {
  private readonly engine = new PredictionEngine();

  constructor(private readonly prisma: PrismaService) {}

  async recalculateForTask(
    taskId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PredictionResult | null> {
    const client = tx ?? this.prisma;
    const completions = await client.taskCompletion.findMany({
      where: { taskId },
      orderBy: { completedAt: 'asc' },
      select: { completedAt: true },
    });

    const result = this.engine.calculate(completions.map((c) => c.completedAt));
    if (result.status === 'learning') {
      return result;
    }

    await client.prediction.upsert({
      where: { taskId },
      create: {
        taskId,
        averageIntervalDays: result.averageIntervalDays,
        minDays: result.minDays,
        bestDay: result.bestDay,
        maxDays: result.maxDays,
        confidenceScore: result.confidenceScore,
        predictedDate: result.predictedDate,
        calculatedAt: new Date(),
      },
      update: {
        averageIntervalDays: result.averageIntervalDays,
        minDays: result.minDays,
        bestDay: result.bestDay,
        maxDays: result.maxDays,
        confidenceScore: result.confidenceScore,
        predictedDate: result.predictedDate,
        calculatedAt: new Date(),
      },
    });

    return result;
  }

  async getForTask(taskId: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const prediction = await this.prisma.prediction.findUnique({
      where: { taskId },
    });

    if (!prediction) {
      const completions = await this.prisma.taskCompletion.count({
        where: { taskId },
      });
      if (completions < 2) {
        return {
          status: 'learning' as const,
          message:
            'Complete this task a few more times so RoutineAI can learn your routine.',
          confidenceScore: 0,
        };
      }
      const recomputed = await this.recalculateForTask(taskId);
      if (!recomputed || recomputed.status === 'learning') {
        return {
          status: 'learning' as const,
          message:
            'Complete this task a few more times so RoutineAI can learn your routine.',
          confidenceScore: 0,
        };
      }
      return this.toResponse(taskId, recomputed);
    }

    return {
      taskId,
      averageIntervalDays: Number(prediction.averageIntervalDays),
      minDays: prediction.minDays,
      bestDay: prediction.bestDay,
      maxDays: prediction.maxDays,
      confidenceScore: Number(prediction.confidenceScore),
      predictedDate: prediction.predictedDate.toISOString().slice(0, 10),
      calculatedAt: prediction.calculatedAt,
    };
  }

  private toResponse(taskId: string, result: PredictionResult) {
    return {
      taskId,
      averageIntervalDays: result.averageIntervalDays,
      minDays: result.minDays,
      bestDay: result.bestDay,
      maxDays: result.maxDays,
      confidenceScore: result.confidenceScore,
      predictedDate: result.predictedDate.toISOString().slice(0, 10),
      calculatedAt: new Date(),
    };
  }
}
