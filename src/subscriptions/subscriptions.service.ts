import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import Stripe from 'stripe';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Retrieve normalized subscription state for a user.
   */
  async getSubscription(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subscriptionStatus: true,
        subscriptionTier: true,
        currentPeriodEnd: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const status = user.subscriptionStatus || 'free';
    const tier = user.subscriptionTier || 'free';
    const isActive = this.isStatusActive(status);
    const isPremium = isActive && (tier === 'pro' || tier === 'pro_family');

    return {
      userId: user.id,
      plan: tier,
      tier,
      status,
      isActive,
      isPremium,
      currentPeriodEnd: user.currentPeriodEnd,
      stripeCustomerId: user.stripeCustomerId,
    };
  }

  /**
   * Helper to check if a user has active Pro access server-side.
   */
  async hasActiveProAccess(userId: string): Promise<boolean> {
    const sub = await this.getSubscription(userId);
    return sub.isPremium;
  }

  /**
   * Helper to check if a user has active Pro + Family access server-side.
   */
  async hasActiveFamilyAccess(userId: string): Promise<boolean> {
    const sub = await this.getSubscription(userId);
    return sub.isPremium && sub.tier === 'pro_family';
  }

  /**
   * WEBHOOK HANDLER: Exclusive place where subscription status is updated in the database.
   */
  async handleWebhookEvent(event: Stripe.Event) {
    this.logger.log(`Processing Stripe Webhook Event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleCheckoutSessionCompleted(session);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.handleInvoicePaymentFailed(invoice);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionDeleted(subscription);
        break;
      }

      default:
        this.logger.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return { received: true };
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const userId = session.client_reference_id || session.metadata?.userId;
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

    if (!userId) {
      this.logger.warn(`Checkout session ${session.id} missing client_reference_id or userId metadata`);
      return;
    }

    const priceId = session.metadata?.priceId;
    const tier = priceId ? this.stripeService.getTierFromPriceId(priceId) : 'pro';

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        stripeCustomerId: stripeCustomerId || undefined,
        subscriptionStatus: 'active',
        subscriptionTier: tier,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    this.logger.log(`Updated user ${userId} subscription status to active (${tier}) via checkout.session.completed`);
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    const stripeCustomerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!stripeCustomerId) return;

    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId },
    });

    if (!user) {
      this.logger.warn(`Invoice payment succeeded for unknown stripe customer: ${stripeCustomerId}`);
      return;
    }

    let currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const lineItem = invoice.lines?.data?.[0];
    if (lineItem?.period?.end) {
      currentPeriodEnd = new Date(lineItem.period.end * 1000);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: 'active',
        currentPeriodEnd,
      },
    });

    this.logger.log(`Updated user ${user.id} subscription status to active via invoice.payment_succeeded`);
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const stripeCustomerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!stripeCustomerId) return;

    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId },
    });

    if (!user) return;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: 'past_due',
      },
    });

    this.logger.log(`Updated user ${user.id} subscription status to past_due via invoice.payment_failed`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const stripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    if (!stripeCustomerId) return;

    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId },
    });

    if (!user) return;

    const status = subscription.status;
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const tier = priceId ? this.stripeService.getTierFromPriceId(priceId) : (user.subscriptionTier || 'pro');
    
    const periodEndSec = (subscription as any).current_period_end;
    const currentPeriodEnd = periodEndSec ? new Date(periodEndSec * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: status,
        subscriptionTier: tier,
        currentPeriodEnd,
      },
    });

    this.logger.log(`Updated user ${user.id} subscription status to ${status} (${tier}) via customer.subscription.updated`);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const stripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    if (!stripeCustomerId) return;

    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId },
    });

    if (!user) return;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: 'canceled',
        subscriptionTier: 'free',
      },
    });

    this.logger.log(`Updated user ${user.id} subscription status to canceled via customer.subscription.deleted`);
  }

  private isStatusActive(status: string): boolean {
    return status === 'active' || status === 'trialing';
  }
}
