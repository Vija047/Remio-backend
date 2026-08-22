import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Headers,
  BadRequestException,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from './stripe.service';

@ApiTags('subscription')
@Controller('subscription')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly stripeService: StripeService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Get dynamic pricing tiers and price IDs from server config' })
  getPricingConfig() {
    return this.stripeService.getPricingConfig();
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user subscription status' })
  getSubscription(@CurrentUser() user: AuthUser) {
    return this.subscriptionsService.getSubscription(user.id);
  }

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user subscription status (alias)' })
  getSubscriptionStatus(@CurrentUser() user: AuthUser) {
    return this.subscriptionsService.getSubscription(user.id);
  }

  @Post('checkout-session')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a Stripe Checkout Session for current user' })
  async createCheckoutSession(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      priceId?: string;
      tier?: 'pro' | 'pro_family';
      interval?: 'monthly' | 'yearly';
      successUrl?: string;
      cancelUrl?: string;
    },
  ) {
    const config = this.stripeService.getPricingConfig();
    let targetPriceId = body.priceId;

    if (!targetPriceId) {
      const selectedTier = body.tier === 'pro_family' ? 'pro_family' : 'pro';
      const isYearly = body.interval === 'yearly';
      targetPriceId = isYearly
        ? config[selectedTier].yearlyPriceId
        : config[selectedTier].monthlyPriceId;
    }

    const currentSub = await this.subscriptionsService.getSubscription(user.id);

    return this.stripeService.createCheckoutSession({
      userId: user.id,
      userEmail: user.email,
      priceId: targetPriceId,
      stripeCustomerId: currentSub.stripeCustomerId,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
  }

  @Get('success-callback')
  @ApiOperation({ summary: 'Stripe Checkout success return landing page' })
  getSuccessCallback() {
    return `<!DOCTYPE html>
<html>
  <head>
    <title>Subscription Successful - RoutineAI</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0B0C10; color: #FFFFFF; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }
      .card { background: #16181F; border: 1px solid #232733; padding: 36px 24px; border-radius: 24px; max-width: 400px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
      .icon { font-size: 52px; margin-bottom: 16px; }
      h1 { font-size: 24px; margin-bottom: 8px; font-weight: 800; letter-spacing: -0.5px; }
      p { color: #9CA3AF; font-size: 15px; margin-bottom: 24px; line-height: 1.5; }
      .btn { display: inline-block; background: #F9FAFB; color: #0B0C10; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-size: 15px; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">🎉</div>
      <h1>Subscription Activated!</h1>
      <p>Thank you for upgrading to RoutineAI. All intelligent prediction features, insights, and unlimited routines are active on your account.</p>
    </div>
  </body>
</html>`;
  }

  @Get('cancel-callback')
  @ApiOperation({ summary: 'Stripe Checkout cancel return landing page' })
  getCancelCallback() {
    return `<!DOCTYPE html>
<html>
  <head>
    <title>Checkout Canceled - RoutineAI</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0B0C10; color: #FFFFFF; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }
      .card { background: #16181F; border: 1px solid #232733; padding: 36px 24px; border-radius: 24px; max-width: 400px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
      .icon { font-size: 52px; margin-bottom: 16px; }
      h1 { font-size: 24px; margin-bottom: 8px; font-weight: 800; letter-spacing: -0.5px; }
      p { color: #9CA3AF; font-size: 15px; margin-bottom: 24px; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">ℹ️</div>
      <h1>Checkout Canceled</h1>
      <p>No payment was processed. You can upgrade anytime from your RoutineAI app settings.</p>
    </div>
  </body>
</html>`;
  }

  @Post('customer-portal')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a Stripe Customer Portal session for subscription management' })
  async createCustomerPortalSession(
    @CurrentUser() user: AuthUser,
    @Body() body: { returnUrl?: string },
  ) {
    const sub = await this.subscriptionsService.getSubscription(user.id);
    if (!sub.stripeCustomerId) {
      throw new BadRequestException(
        'No active Stripe customer profile found. Please subscribe to Pro to manage billing.',
      );
    }

    return this.stripeService.createCustomerPortalSession({
      stripeCustomerId: sub.stripeCustomerId,
      returnUrl: body.returnUrl,
    });
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook listener endpoint' })
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException(
        'Raw body request buffer is missing. Ensure NestFactory rawBody is enabled.',
      );
    }

    const event = this.stripeService.constructWebhookEvent(rawBody, signature);
    return this.subscriptionsService.handleWebhookEvent(event);
  }

  @Get('family-members')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get family members (Gated: Pro + Family tier required)' })
  async getFamilyMembers(@CurrentUser() user: AuthUser) {
    const hasFamilyTier = await this.subscriptionsService.hasActiveFamilyAccess(user.id);
    if (!hasFamilyTier) {
      throw new ForbiddenException(
        'Family Sharing requires an active Pro + Family subscription plan.',
      );
    }

    return {
      familyTierActive: true,
      maxMembers: 5,
      members: [
        { id: user.id, email: user.email, role: 'owner', status: 'active' },
      ],
    };
  }
}
