import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PaymentProvider } from '@prisma/client';
import { WEBHOOK_JOB, WEBHOOK_QUEUE } from './queues';
import { PaymentsService, PaymentWebhookPayload } from '../payments/payments.service';
import { ProcessedEventsService } from '../webhooks/processed-events.service';
import { WebhookEventsService } from '../webhooks/webhook-events.service';

interface WebhookJobData {
  provider: PaymentProvider;
  eventId: string;
}

@Processor(WEBHOOK_QUEUE)
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private readonly processedEventsService: ProcessedEventsService,
    private readonly webhookEventsService: WebhookEventsService,
    private readonly paymentsService: PaymentsService,
  ) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { provider, eventId } = job.data;
    const claimed = await this.processedEventsService.claimProcessing(
      provider,
      eventId,
    );

    if (!claimed) {
      return;
    }

    try {
      const event = await this.webhookEventsService.getLatest(provider, eventId);
      if (!event) {
        throw new Error('Webhook payload not found');
      }

      const payload = JSON.parse(Buffer.from(event.rawBody).toString('utf8')) as Record<
        string,
        unknown
      >;

      const paymentPayload = this.mapPayload(provider, payload);
      await this.paymentsService.finalizeFromWebhook(
        provider,
        eventId,
        paymentPayload,
      );

      await this.processedEventsService.markProcessed(provider, eventId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook processing failed: ${message}`);
      await this.processedEventsService.markFailed(provider, eventId, message);
      throw error;
    }
  }

  private mapPayload(
    provider: PaymentProvider,
    payload: Record<string, unknown>,
  ): PaymentWebhookPayload {
    if (provider === PaymentProvider.STRIPE) {
      const data = (payload.data as { object?: Record<string, unknown> } | undefined)
        ?.object;
      const metadata = (data?.metadata as Record<string, string> | undefined) ?? {};
      const providerReference =
        metadata.internal_payment_intent_id ||
        (data?.id as string | undefined) ||
        (data?.payment_intent as string | undefined) ||
        (payload.id as string | undefined) ||
        '';

      if (!providerReference) {
        throw new Error('Stripe payload missing payment intent reference');
      }

      const amountValue =
        (data?.amount_received as string | number | undefined) ??
        (data?.amount as string | number | undefined) ??
        0;

      const amount = this.toBigInt(amountValue);
      const currency = ((data?.currency as string | undefined) ?? 'USD').toUpperCase();
      const status =
        payload.type === 'payment_intent.succeeded' ? 'SUCCEEDED' : 'FAILED';

      return { providerReference, amount, currency, status };
    }

    const data = (payload.data as Record<string, unknown> | undefined) ?? payload;
    const meta = (data.meta as Record<string, unknown> | undefined) ?? {};
    const providerReference =
      (meta.internal_payment_intent_id as string | undefined) ||
      (data.id as string | undefined) ||
      (payload.id as string | undefined) ||
      '';

    if (!providerReference) {
      throw new Error('Flutterwave payload missing payment intent reference');
    }

    const amountValue =
      (data.amount as string | number | undefined) ??
      (data.amount_settled as string | number | undefined) ??
      0;

    const amount = this.toBigInt(amountValue);
    const currency = ((data.currency as string | undefined) ?? 'USD').toUpperCase();
    const statusValue = (data.status as string | undefined) ?? 'failed';
    const status = statusValue.toLowerCase() === 'successful' ? 'SUCCEEDED' : 'FAILED';

    return { providerReference, amount, currency, status };
  }

  private toBigInt(value: string | number): bigint {
    if (typeof value === 'string') {
      return BigInt(value);
    }

    return BigInt(Math.trunc(value));
  }
}
