import { BadRequestException, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FastifyRequest } from 'fastify';
import { PaymentProvider, Prisma } from '@prisma/client';
import { WEBHOOK_JOB, WEBHOOK_QUEUE } from '../jobs/queues';
import { FlutterwaveWebhookService } from './flutterwave-webhook.service';
import { ProcessedEventsService } from './processed-events.service';
import { StripeWebhookService } from './stripe-webhook.service';
import { WebhookEventsService } from './webhook-events.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly stripeWebhookService: StripeWebhookService,
    private readonly flutterwaveWebhookService: FlutterwaveWebhookService,
    private readonly processedEventsService: ProcessedEventsService,
    private readonly webhookEventsService: WebhookEventsService,
    @InjectQueue(WEBHOOK_QUEUE)
    private readonly webhookQueue: Queue,
  ) {}

  @Post('stripe')
  @HttpCode(200)
  async handleStripe(@Req() request: FastifyRequest) {
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    const rawBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(rawBody);

    const signature = request.headers['stripe-signature'] as string | undefined;
    const event = this.stripeWebhookService.constructEvent(rawBuffer, signature);

    await this.webhookEventsService.record(
      PaymentProvider.STRIPE,
      event.id,
      rawBuffer,
      request.headers as Prisma.InputJsonValue,
    );

    await this.processedEventsService.ensureReceived(
      PaymentProvider.STRIPE,
      event.id,
    );

    await this.webhookQueue.add(WEBHOOK_JOB, {
      provider: PaymentProvider.STRIPE,
      eventId: event.id,
    });

    return { received: true };
  }

  @Post('flutterwave')
  @HttpCode(200)
  async handleFlutterwave(@Req() request: FastifyRequest) {
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    const rawBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(rawBody);

    const isValid = this.flutterwaveWebhookService.verify(
      rawBuffer,
      request.headers as Record<string, string | undefined>,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid Flutterwave signature');
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBuffer.toString('utf8')) as Record<string, unknown>;
    } catch (error) {
      throw new BadRequestException('Invalid payload');
    }

    const eventId =
      (payload.id as string | undefined) ||
      (payload.eventId as string | undefined) ||
      (payload.data as { id?: string; eventId?: string } | undefined)?.id ||
      (payload.data as { id?: string; eventId?: string } | undefined)?.eventId;

    if (!eventId) {
      throw new BadRequestException('Missing Flutterwave event id');
    }

    await this.webhookEventsService.record(
      PaymentProvider.FLUTTERWAVE,
      eventId,
      rawBuffer,
      request.headers as Prisma.InputJsonValue,
    );

    await this.processedEventsService.ensureReceived(
      PaymentProvider.FLUTTERWAVE,
      eventId,
    );

    await this.webhookQueue.add(WEBHOOK_JOB, {
      provider: PaymentProvider.FLUTTERWAVE,
      eventId,
    });

    return { received: true };
  }
}
