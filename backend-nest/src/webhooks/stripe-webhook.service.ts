import { BadRequestException, Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeWebhookService {
  private readonly stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
      apiVersion: '2025-02-24.acacia',
    });
  }

  constructEvent(rawBody: Buffer, signature?: string): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      throw new BadRequestException('Stripe webhook secret not configured');
    }

    if (!signature) {
      throw new BadRequestException('Missing Stripe signature header');
    }

    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }
}
