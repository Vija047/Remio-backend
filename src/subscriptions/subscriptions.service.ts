import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return {
        plan: 'free',
        status: 'active',
        isPremium: false,
        startedAt: null,
        expiresAt: null,
        revenuecatCustomerId: null,
        source: 'mock',
      };
    }

    const isPremium = this.isPremiumStatus(subscription.status, subscription.plan);
    return {
      plan: subscription.plan,
      status: subscription.status,
      isPremium,
      startedAt: subscription.startedAt,
      expiresAt: subscription.expiresAt,
      revenuecatCustomerId: subscription.revenuecatCustomerId,
      source: 'database',
    };
  }

  async isPremium(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    return subscription.isPremium;
  }

  private isPremiumStatus(status: string, plan: string): boolean {
    return (
      status === 'active' &&
      ['premium', 'pro', 'plus'].includes(plan.toLowerCase())
    );
  }
}
