import Stripe from 'stripe';

export class StripeAdapter {
  private readonly client: Stripe;

  constructor() {
    this.client = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
      apiVersion: '2023-10-16',
    });
  }

  async createConnectAccountExpress() {
    return this.client.accounts.create({
      type: 'express',
    });
  }

  async createAccountOnboardingLink(accountId: string) {
    return this.client.accountLinks.create({
      account: accountId,
      refresh_url: process.env.STRIPE_REFRESH_URL ?? 'https://example.com/refresh',
      return_url: process.env.STRIPE_RETURN_URL ?? 'https://example.com/return',
      type: 'account_onboarding',
    });
  }

  async createDirectChargePaymentIntent(params: {
    connectedAccountId: string;
    amount: number;
    currency: string;
    fee: number;
    metadata?: Record<string, string>;
  }) {
    return this.client.paymentIntents.create(
      {
        amount: params.amount,
        currency: params.currency,
        application_fee_amount: params.fee,
        metadata: params.metadata,
      },
      { stripeAccount: params.connectedAccountId },
    );
  }

  async createSubscriptionForPlatformCustomer(params: {
    customerId: string;
    priceId: string;
  }) {
    return this.client.subscriptions.create({
      customer: params.customerId,
      items: [{ price: params.priceId }],
    });
  }

  verifyWebhook(rawBody: Buffer, signatureHeader: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
    return this.client.webhooks.constructEvent(rawBody, signatureHeader, secret);
  }
}
