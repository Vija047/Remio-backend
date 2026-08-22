import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TasksService ownership', () => {
  const prisma = {
    task: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const scheduler = {
    schedule: jest.fn().mockResolvedValue({ id: 'n1' }),
  };

  const predictionsService = {
    recalculateForTask: jest.fn().mockResolvedValue({ status: 'ready' }),
  };

  const subscriptionsService = {
    hasActiveProAccess: jest.fn().mockResolvedValue(true),
  };

  const service = new TasksService(
    prisma as unknown as PrismaService,
    scheduler as any,
    predictionsService as any,
    subscriptionsService as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only the authenticated user tasks', async () => {
    prisma.task.findMany.mockResolvedValue([]);
    await service.findAll('user-1');
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
  });

  it('throws when accessing another user task', async () => {
    prisma.task.findFirst.mockResolvedValue(null);
    await expect(service.findOne('task-1', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a task for the authenticated user', async () => {
    prisma.task.create.mockResolvedValue({ id: 't1' });
    prisma.task.findFirst.mockResolvedValue({ id: 't1', title: 'Filter', userId: 'user-1' });
    await service.create('user-1', {
      title: 'Filter',
      category: 'home',
      reminderEnabled: true,
      reminderTime: '09:00',
    });
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', title: 'Filter' }),
      }),
    );
  });
});
