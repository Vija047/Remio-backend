import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async getInsights(userId: string) {
    const now = new Date();
    const tasks = await this.prisma.task.findMany({
      where: { userId },
      include: {
        prediction: true,
        completions: {
          orderBy: { completedAt: 'asc' },
          select: { completedAt: true },
        },
      },
    });

    const activeTasks = tasks.filter((task) => task.isActive);
    const totalActiveTasks = activeTasks.length;
    const completedTasks = tasks.reduce(
      (sum, task) => sum + task.completions.length,
      0,
    );

    const overdueTasks = activeTasks.filter(
      (task) =>
        task.prediction && task.prediction.predictedDate.getTime() < now.getTime(),
    ).length;

    const upcomingTasks = activeTasks.filter(
      (task) =>
        task.prediction &&
        task.prediction.predictedDate.getTime() >= now.getTime(),
    ).length;

    const tasksLearning = activeTasks.filter(
      (task) => !task.prediction || task.completions.length < 2,
    ).length;

    const consistency = activeTasks
      .map((task) => {
        if (!task.prediction) {
          return null;
        }
        return {
          taskId: task.id,
          title: task.title,
          confidence: Number(task.prediction.confidenceScore),
          averageIntervalDays: Number(task.prediction.averageIntervalDays),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const mostConsistentTask =
      consistency.length === 0
        ? null
        : consistency.reduce((best, current) =>
            current.confidence > best.confidence ? current : best,
          );
    const leastConsistentTask =
      consistency.length === 0
        ? null
        : consistency.reduce((worst, current) =>
            current.confidence < worst.confidence ? current : worst,
          );

    const intervals = consistency.map((item) => item.averageIntervalDays);
    const averageCompletionInterval =
      intervals.length === 0
        ? null
        : intervals.reduce((sum, value) => sum + value, 0) / intervals.length;

    let onTimeCompletions = 0;
    let evaluatedCompletions = 0;
    for (const task of activeTasks) {
      if (!task.prediction || task.completions.length < 2) {
        continue;
      }
      const last = task.completions[task.completions.length - 1];
      const previous = task.completions[task.completions.length - 2];
      const actualDays =
        (last.completedAt.getTime() - previous.completedAt.getTime()) /
        (24 * 60 * 60 * 1000);
      evaluatedCompletions += 1;
      if (
        actualDays >= task.prediction.minDays &&
        actualDays <= task.prediction.maxDays
      ) {
        onTimeCompletions += 1;
      }
    }

    const onTimeCompletionPercentage =
      evaluatedCompletions === 0
        ? null
        : Math.round((onTimeCompletions / evaluatedCompletions) * 10000) / 100;

    return {
      totalActiveTasks,
      completedTasks,
      overdueTasks,
      upcomingTasks,
      onTimeCompletionPercentage,
      mostConsistentTask,
      leastConsistentTask,
      tasksCurrentlyLearning: tasksLearning,
      averageCompletionInterval:
        averageCompletionInterval === null
          ? null
          : Math.round(averageCompletionInterval * 100) / 100,
    };
  }
}
