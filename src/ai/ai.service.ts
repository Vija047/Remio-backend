import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  validateSync,
} from 'class-validator';
import { PredictionsService } from '../predictions/predictions.service';
import { PrismaService } from '../prisma/prisma.service';
import { OpenRouterService } from './openrouter.service';
import {
  PREPARATION_SYSTEM_PROMPT,
  PARSE_TASK_SYSTEM_PROMPT,
  ROUTINE_COACH_SYSTEM_PROMPT,
  buildParseTaskUserPrompt,
  buildPreparationUserPrompt,
  buildRoutineCoachUserPrompt,
} from './prompts';

class ParsedTaskResponse {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  @MaxLength(100)
  category: string;

  @IsOptional()
  @IsString()
  description: string | null;

  @IsIn(['fixed', 'flexible'])
  recurrenceType: 'fixed' | 'flexible';

  @IsOptional()
  @IsNumber()
  @Min(1)
  intervalDays: number | null;

  @IsBoolean()
  reminderEnabled: boolean;
}

class RoutineCoachResponse {
  @IsString()
  summary: string;

  @IsArray()
  @IsString({ each: true })
  recommendations: string[];
}

class PreparationResponse {
  @IsString()
  suggestion: string;
}

@Injectable()
export class AiService {
  constructor(
    private readonly openRouter: OpenRouterService,
    private readonly prisma: PrismaService,
    private readonly predictionsService: PredictionsService,
  ) {}

  async parseTask(text: string) {
    const raw = await this.openRouter.chatCompletion([
      { role: 'system', content: PARSE_TASK_SYSTEM_PROMPT },
      { role: 'user', content: buildParseTaskUserPrompt(text) },
    ]);
    const parsed = this.parseJson(raw);
    return this.validateDto(ParsedTaskResponse, parsed);
  }

  async routineCoach(userId: string) {
    const summary = await this.buildCoachSummary(userId);
    const raw = await this.openRouter.chatCompletion([
      { role: 'system', content: ROUTINE_COACH_SYSTEM_PROMPT },
      { role: 'user', content: buildRoutineCoachUserPrompt(summary) },
    ]);
    const parsed = this.parseJson(raw);
    return this.validateDto(RoutineCoachResponse, parsed);
  }

  async preparation(taskId: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const prediction = await this.predictionsService.getForTask(taskId, userId);
    if ('status' in prediction && prediction.status === 'learning') {
      return {
        suggestion:
          'RoutineAI is still learning this task. Complete it a few more times for preparation tips tied to a predicted date.',
      };
    }

    const payload = {
      title: task.title,
      category: task.category,
      description: task.description,
      prediction,
    };

    const raw = await this.openRouter.chatCompletion([
      { role: 'system', content: PREPARATION_SYSTEM_PROMPT },
      { role: 'user', content: buildPreparationUserPrompt(payload) },
    ]);
    const parsed = this.parseJson(raw);
    return this.validateDto(PreparationResponse, parsed);
  }

  parseAndValidateAiJson<T extends object>(
    cls: new () => T,
    raw: string,
  ): T {
    const parsed = this.parseJson(raw);
    return this.validateDto(cls, parsed);
  }

  private async buildCoachSummary(userId: string) {
    const now = new Date();
    const tasks = await this.prisma.task.findMany({
      where: { userId, isActive: true },
      include: {
        prediction: true,
        completions: {
          orderBy: { completedAt: 'desc' },
          take: 1,
        },
      },
    });

    const upcoming = tasks
      .filter(
        (task) =>
          task.prediction && task.prediction.predictedDate.getTime() >= now.getTime(),
      )
      .map((task) => ({
        taskId: task.id,
        title: task.title,
        predictedDate: task.prediction!.predictedDate.toISOString().slice(0, 10),
        confidenceScore: Number(task.prediction!.confidenceScore),
        minDays: task.prediction!.minDays,
        maxDays: task.prediction!.maxDays,
      }))
      .slice(0, 10);

    const overdue = tasks
      .filter(
        (task) =>
          task.prediction && task.prediction.predictedDate.getTime() < now.getTime(),
      )
      .map((task) => ({
        taskId: task.id,
        title: task.title,
        predictedDate: task.prediction!.predictedDate.toISOString().slice(0, 10),
        confidenceScore: Number(task.prediction!.confidenceScore),
      }))
      .slice(0, 10);

    const recentCompletions = await this.prisma.taskCompletion.findMany({
      where: { task: { userId } },
      orderBy: { completedAt: 'desc' },
      take: 10,
      include: { task: { select: { id: true, title: true } } },
    });

    const intervalChanges = tasks
      .filter((task) => task.prediction)
      .map((task) => ({
        taskId: task.id,
        title: task.title,
        averageIntervalDays: Number(task.prediction!.averageIntervalDays),
        confidenceScore: Number(task.prediction!.confidenceScore),
      }))
      .slice(0, 10);

    return {
      upcomingPredictedTasks: upcoming,
      overdueTasks: overdue,
      recentlyCompletedTasks: recentCompletions.map((item) => ({
        taskId: item.task.id,
        title: item.task.title,
        completedAt: item.completedAt,
      })),
      predictionConfidence: intervalChanges,
      recentIntervalChanges: intervalChanges,
    };
  }

  private parseJson(raw: string): unknown {
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '');
    try {
      return JSON.parse(cleaned);
    } catch {
      throw new BadGatewayException('AI returned invalid JSON');
    }
  }

  private validateDto<T extends object>(cls: new () => T, data: unknown): T {
    const instance = plainToInstance(cls, data);
    const errors = validateSync(instance as object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      throw new BadGatewayException('AI returned an invalid response shape');
    }
    return instance;
  }
}

export { ParsedTaskResponse, RoutineCoachResponse, PreparationResponse };
