import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the authenticated user' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.notificationsService.findAll(user.id);
  }

  @Post('test')
  @ApiOperation({ summary: 'Trigger a test notification for the authenticated user' })
  createTest(@CurrentUser() user: AuthUser) {
    return this.notificationsService.createTestNotification(user.id);
  }

  @Post('priority-test')
  @ApiOperation({ summary: 'Trigger a priority notification (Gated: Pro required)' })
  async createPriorityTest(@CurrentUser() user: AuthUser) {
    const isPro = await this.subscriptionsService.hasActiveProAccess(user.id);
    if (!isPro) {
      throw new ForbiddenException(
        'Priority notifications require an active Pro subscription.',
      );
    }
    return this.notificationsService.createTestNotification(user.id);
  }

  @Post('push-token')
  @ApiOperation({ summary: 'Register Expo push notification token for the user' })
  savePushToken(
    @CurrentUser() user: AuthUser,
    @Body('pushToken') pushToken: string,
  ) {
    return this.notificationsService.savePushToken(user.id, pushToken);
  }

  @Post('dispatch')
  @ApiOperation({ summary: 'Trigger background dispatch of due notifications' })
  dispatchPending() {
    return this.notificationsService.dispatchPending();
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markRead(id, user.id);
  }
}
