import { TaskCompletionsService } from './task-completions.service';
import { PredictionsService } from '../predictions/predictions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TaskCompletionsService', () => {
  const prisma = {
    task: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const predictionsService = {
    recalculateForTask: jest.fn(),
  };

  const service = new TaskCompletionsService(
    prisma as unknown as PrismaService,
    predictionsService as unknown as PredictionsService,
  );

  it('completes a task inside a transaction and returns prediction', async () => {
    prisma.task.findFirst.mockResolvedValue({ id: 't1', userId: 'u1' });
    predictionsService.recalculateForTask.mockResolvedValue({
      status: 'ready',
      predictedDate: new Date('2026-09-12'),
      minDays: 29,
      maxDays: 34,
      confidenceScore: 0.82,
      bestDay: 31,
      averageIntervalDays: 31.2,
    });

    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        taskCompletion: {
          create: jest.fn().mockResolvedValue({
            id: 'c1',
            completedAt: new Date('2026-08-01'),
            notes: null,
          }),
        },
      };
      return fn(tx);
    });

    const result = await service.complete('t1', 'u1', {});
    expect(result.completion.id).toBe('c1');
    expect(result.prediction).toMatchObject({
      minDays: 29,
      maxDays: 34,
      confidenceScore: 0.82,
    });
    expect(predictionsService.recalculateForTask).toHaveBeenCalled();
  });
});
