import { Controller, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InsightsService } from './insights.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@ApiTags('insights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('insights')
export class InsightsController {
  constructor(
    private readonly insightsService: InsightsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get calculated routine insights (Gated: Pro required)' })
  async getInsights(@CurrentUser() user: AuthUser) {
    const isPro = await this.subscriptionsService.hasActiveProAccess(user.id);
    if (!isPro) {
      throw new ForbiddenException(
        'Insights feature requires an active Pro subscription.',
      );
    }
    return this.insightsService.getInsights(user.id);
  }
}
