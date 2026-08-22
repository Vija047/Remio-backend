import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface PlanPricingConfig {
  tier: 'pro' | 'pro_family';
  name: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
  monthlyAmount: number;
  yearlyAmount: number;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.getOrThrow<string>('STRIPE_SECRET_KEY');
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-01-27.acacia' as any,
    });
  }

  /**
   * Get configured price IDs and metadata (never hardcoded in frontend).
   */
  getPricingConfig() {
    return {
      pro: {
        tier: 'pro',
        name: 'Pro',
        monthlyPriceId: this.configService.get<string>('STRIPE_PRICE_PRO_MONTHLY') ?? '',
        yearlyPriceId: this.configService.get<string>('STRIPE_PRICE_PRO_YEARLY') ?? '',
        features: [
          'Unlimited routines & tasks',
          'AI Smart Predictions',
          'Advanced Routine Insights',
          'Priority Notifications',
          'Cloud Sync & Backup',
        ],
      },
      pro_family: {
        tier: 'pro_family',
        name: 'Pro + Family',
        monthlyPriceId: this.configService.get<string>('STRIPE_PRICE_PRO_FAMILY_MONTHLY') ?? '',
        yearlyPriceId: this.configService.get<string>('STRIPE_PRICE_PRO_FAMILY_YEARLY') ?? '',
        features: [
          'All Pro features included',
          'Up to 5 Family Members',
          'Shared Routine Checklists',
          'Family Progress Analytics',
          'VIP Priority Support',
        ],
      },
    };
  }

  /**
   * Determine subscription tier from a Stripe Price ID or Product ID string.
   */
  getTierFromPriceId(priceId: string): 'pro' | 'pro_family' {
    const config = this.getPricingConfig();
    if (
      priceId === config.pro_family.monthlyPriceId ||
      priceId === config.pro_family.yearlyPriceId ||
      priceId.includes('family') ||
      priceId.includes('Family')
    ) {
      return 'pro_family';
    }
    return 'pro';
  }

  /**
   * Resolves a price/product identifier (Price ID 'price_...', Product ID 'prod_...', or placeholder)
   * into a valid Stripe Checkout LineItem configuration.
   */
  private async resolveLineItem(
    priceId: string,
    tier: 'pro' | 'pro_family',
    isYearly: boolean,
  ): Promise<Stripe.Checkout.SessionCreateParams.LineItem> {
    // 1. Standard Stripe Price ID (starts with 'price_')
    if (priceId.startsWith('price_') && !priceId.includes('Test')) {
      return { price: priceId, quantity: 1 };
    }

    // 2. Stripe Product ID (starts with 'prod_')
    if (priceId.startsWith('prod_')) {
      try {
        const prices = await this.stripe.prices.list({
          product: priceId,
          active: true,
          limit: 1,
        });

        if (prices.data && prices.data.length > 0) {
          this.logger.log(`Resolved Product ID '${priceId}' to active Price ID '${prices.data[0].id}'`);
          return { price: prices.data[0].id, quantity: 1 };
        }
      } catch (err: any) {
        this.logger.warn(`Could not query prices for product '${priceId}': ${err.message}`);
      }

      // If Product ID exists but no active Price ID found, attach price_data with product reference
      const unitAmount = isYearly
        ? (tier === 'pro_family' ? 6708 : 4188)
        : (tier === 'pro_family' ? 799 : 499);

      return {
        price_data: {
          currency: 'usd',
          product: priceId,
          unit_amount: unitAmount,
          recurring: {
            interval: isYearly ? 'year' : 'month',
          },
        },
        quantity: 1,
      };
    }

    // 3. Fallback for custom or placeholder string: inline price_data with product_data
    const unitAmount = isYearly
      ? (tier === 'pro_family' ? 6708 : 4188)
      : (tier === 'pro_family' ? 799 : 499);

    return {
      price_data: {
        currency: 'usd',
        product_data: {
          name: tier === 'pro_family' ? 'RoutineAI Pro + Family' : 'RoutineAI Pro',
          description: 'RoutineAI Subscription Plan',
        },
        unit_amount: unitAmount,
        recurring: {
          interval: isYearly ? 'year' : 'month',
        },
      },
      quantity: 1,
    };
  }

  /**
   * Create a Stripe Checkout Session for subscription purchase.
   */
  async createCheckoutSession(params: {
    userId: string;
    userEmail: string;
    priceId: string;
    stripeCustomerId?: string | null;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<{ sessionId: string; url: string }> {
    const { userId, userEmail, priceId, stripeCustomerId, successUrl, cancelUrl } = params;
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    const tier = this.getTierFromPriceId(priceId);
    const isYearly = priceId.includes('yearly') || priceId.includes('Yearly');

    try {
      const lineItem = await this.resolveLineItem(priceId, tier, isYearly);

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        ...(stripeCustomerId ? { customer: stripeCustomerId } : { customer_email: userEmail }),
        line_items: [lineItem],
        client_reference_id: userId,
        metadata: {
          userId,
          priceId,
          tier,
        },
        success_url: successUrl || `${appUrl}/api/subscription/success-callback?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${appUrl}/api/subscription/cancel-callback`,
      });

      if (!session.url) {
        throw new BadRequestException('Failed to generate checkout session URL from Stripe');
      }

      return {
        sessionId: session.id,
        url: session.url,
      };
    } catch (error: any) {
      this.logger.error(`Stripe checkout session error: ${error.message}`, error.stack);

      // Secondary fallback if primary lineItem resolution failed
      try {
        const unitAmount = isYearly
          ? (tier === 'pro_family' ? 6708 : 4188)
          : (tier === 'pro_family' ? 799 : 499);

        const fallbackSession = await this.stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'subscription',
          ...(stripeCustomerId ? { customer: stripeCustomerId } : { customer_email: userEmail }),
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: tier === 'pro_family' ? 'RoutineAI Pro + Family' : 'RoutineAI Pro',
                  description: 'RoutineAI Subscription Plan',
                },
                unit_amount: unitAmount,
                recurring: {
                  interval: isYearly ? 'year' : 'month',
                },
              },
              quantity: 1,
            },
          ],
          client_reference_id: userId,
          metadata: {
            userId,
            priceId,
            tier,
          },
          success_url: successUrl || `${appUrl}/api/subscription/success-callback?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: cancelUrl || `${appUrl}/api/subscription/cancel-callback`,
        });

        if (fallbackSession.url) {
          return {
            sessionId: fallbackSession.id,
            url: fallbackSession.url,
          };
        }
      } catch (fallbackError: any) {
        this.logger.error(`Secondary checkout fallback error: ${fallbackError.message}`, fallbackError.stack);
      }

      if (
        error.message?.includes('account or business name') ||
        error.message?.includes('dashboard.stripe.com/account') ||
        error.message?.includes('dashboard.stripe.com')
      ) {
        throw new BadRequestException(
          'Stripe Account Setup Required: Please set your Business Name at https://dashboard.stripe.com/settings/public (or https://dashboard.stripe.com/account) to enable Stripe Checkout.',
        );
      }

      // Fallback for offline/placeholder key environments
      if (error.message?.includes('Invalid API Key') || error.message?.includes('api_key_invalid')) {
        this.logger.warn('Fallback: Returning dev mock checkout session URL');
        return {
          sessionId: `cs_test_mock_${Date.now()}`,
          url: `${appUrl}/api/subscription/mock-checkout?userId=${userId}&priceId=${priceId}`,
        };
      }

      throw new BadRequestException(error.message || 'Unable to create Stripe checkout session');
    }
  }

  /**
   * Create a Stripe Customer Portal session.
   */
  async createCustomerPortalSession(params: {
    stripeCustomerId: string;
    returnUrl?: string;
  }): Promise<{ url: string }> {
    const { stripeCustomerId, returnUrl } = params;
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';

    try {
      const portalSession = await this.stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl || `${appUrl}/api/subscription/portal-return`,
      });

      return { url: portalSession.url };
    } catch (error: any) {
      this.logger.error(`Stripe customer portal error: ${error.message}`, error.stack);

      if (error.message?.includes('Invalid API Key') || error.message?.includes('api_key_invalid')) {
        return {
          url: `${appUrl}/api/subscription/mock-portal?customer=${stripeCustomerId}`,
        };
      }

      throw new BadRequestException(error.message || 'Unable to create customer portal session');
    }
  }

  /**
   * Construct and verify Stripe webhook event from raw body buffer and signature header.
   */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET is missing in environment variables');
    }

    try {
      return this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }
  }

  /**
   * Helper to retrieve subscription details directly from Stripe if needed.
   */
  async getSubscriptionDetails(subscriptionId: string): Promise<Stripe.Subscription | null> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      this.logger.error(`Failed to retrieve subscription ${subscriptionId}`, error);
      return null;
    }
  }
}
