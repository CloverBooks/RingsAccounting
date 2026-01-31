import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeAdapter } from '../payments/stripe.adapter';
import { FlutterwaveAdapter } from '../payments/flutterwave.adapter';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeAdapter: StripeAdapter,
    private readonly flutterwaveAdapter: FlutterwaveAdapter,
    @InjectQueue('webhook.ingress') private readonly ingressQueue: Queue,
  ) {}

  async handleStripeWebhook(rawBody: Buffer, signature: string | undefined, headers: Record<string, any>) {
    if (!signature) {
      throw new Error('Missing Stripe signature');
    }
    const event = this.stripeAdapter.verifyWebhook(rawBody, signature);
    const stored = await this.storeWebhookEvent('STRIPE', event.id, rawBody, headers, true, event);
    if (stored.deduped) {
      return { deduped: true };
    }
    await this.ingressQueue.add('process_stripe_event', { provider: 'STRIPE', event }, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
    });
    return { ok: true };
  }

  async handleFlutterwaveWebhook(rawBody: Buffer, headers: Record<string, any>, payload: any) {
    const verification = this.flutterwaveAdapter.verifyWebhook(rawBody, {
      'verif-hash': headers['verif-hash'],
      'flutterwave-signature': headers['flutterwave-signature'],
    });

    const signatureValid = verification.valid;
    const eventId = payload?.data?.id ? String(payload.data.id) : null;
    const stored = await this.storeWebhookEvent('FLUTTERWAVE', eventId, rawBody, headers, signatureValid, payload);
    if (stored.deduped) {
      return { deduped: true };
    }
    await this.ingressQueue.add('process_flutterwave_event', { provider: 'FLUTTERWAVE', event: payload }, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
    });
    return { ok: true };
  }

  private async storeWebhookEvent(
    provider: 'STRIPE' | 'FLUTTERWAVE',
    eventId: string | null,
    rawBody: Buffer,
    headers: Record<string, any>,
    signatureValid: boolean,
    payload: any,
  ) {
    const dedupeResult = await this.dedupe(provider, eventId);
    await this.prisma.webhookEvent.create({
      data: {
        provider,
        event_id: eventId,
        signature_valid: signatureValid,
        headers,
        payload,
        raw_body: rawBody.toString('utf8'),
        processed: false,
      },
    });
    return dedupeResult;
  }

  private async dedupe(provider: 'STRIPE' | 'FLUTTERWAVE', eventId: string | null) {
    if (!eventId) {
      return { deduped: false };
    }
    try {
      await this.prisma.processedEvent.create({
        data: {
          provider,
          event_id: eventId,
          status: 'RECEIVED',
        },
      });
      return { deduped: false };
    } catch (error) {
      return { deduped: true };
    }
  }
}
