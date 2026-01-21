import { execSync } from 'child_process';
import path from 'path';
import request from 'supertest';
import Stripe from 'stripe';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PaymentProvider } from '@prisma/client';
import { createApp } from '../src/bootstrap';
import { WEBHOOK_JOB, WEBHOOK_QUEUE } from '../src/jobs/queues';
import { WebhookReaperService } from '../src/jobs/webhook-reaper.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProcessedEventsService } from '../src/webhooks/processed-events.service';
import { WebhookEventsService } from '../src/webhooks/webhook-events.service';

const integrationSchema = 'integration_test';

process.env.DATABASE_URL = `postgresql://clover:clover_dev_password@localhost:5432/clover_books?schema=${integrationSchema}`;
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.STRIPE_SECRET_KEY = 'sk_test_123';
process.env.FLW_SECRET_HASH = 'flw_secret_hash';

const stripe = new Stripe('sk_test_123', { apiVersion: '2025-02-24.acacia' });

describe('Payments integration', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let prisma: PrismaService;
  let queue: Queue;
  let reaper: WebhookReaperService;
  let webhookEvents: WebhookEventsService;
  let processedEvents: ProcessedEventsService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    queue = app.get(getQueueToken(WEBHOOK_QUEUE));
    reaper = app.get(WebhookReaperService);
    webhookEvents = app.get(WebhookEventsService);
    processedEvents = app.get(ProcessedEventsService);

    await prisma.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS "${integrationSchema}";`,
    );

    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });
  });

  beforeEach(async () => {
    if (queue) {
      await queue.drain();
    }
    if (prisma) {
      await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE "PaymentReceipt", "LedgerLine", "LedgerEntry", "PaymentIntent", "ProcessedEvent", "WebhookEvent" CASCADE;',
      );
    }
  });

  afterAll(async () => {
    if (queue) {
      await queue.close();
    }
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  const waitForStatus = async (eventId: string, status: string) => {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const record = await prisma.processedEvent.findUnique({
        where: {
          provider_eventId: { provider: PaymentProvider.STRIPE, eventId },
        },
      });

      if (record?.status === status) {
        return record;
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(`Timed out waiting for ${status}`);
  };

  it('processes webhooks exactly once and recovers from crashes', async () => {
    const intentResponse = await request(app.getHttpServer())
      .post('/payments/intents')
      .send({
        amount: '5000',
        currency: 'usd',
        provider: 'STRIPE',
        providerReference: 'pi_test_123',
      })
      .expect(201);

    const payload = JSON.stringify({
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123',
          amount_received: 5000,
          currency: 'usd',
        },
      },
    });

    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    });

    await request(app.getHttpServer())
      .post('/webhooks/stripe')
      .set('stripe-signature', signature)
      .send(payload)
      .expect(200);

    await waitForStatus('evt_123', 'PROCESSED');

    const ledgerCount = await prisma.ledgerEntry.count();
    expect(ledgerCount).toBe(1);

    await request(app.getHttpServer())
      .post('/webhooks/stripe')
      .set('stripe-signature', signature)
      .send(payload)
      .expect(200);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const ledgerCountAfterRetry = await prisma.ledgerEntry.count();
    expect(ledgerCountAfterRetry).toBe(1);

    const crashIntent = await request(app.getHttpServer())
      .post('/payments/intents')
      .send({
        amount: '7000',
        currency: 'usd',
        provider: 'STRIPE',
        providerReference: 'pi_test_crash',
      })
      .expect(201);

    const crashPayload = JSON.stringify({
      id: 'evt_crash',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_crash',
          amount_received: 7000,
          currency: 'usd',
        },
      },
    });

    await webhookEvents.record(
      PaymentProvider.STRIPE,
      'evt_crash',
      Buffer.from(crashPayload),
      {},
    );

    await processedEvents.ensureReceived(PaymentProvider.STRIPE, 'evt_crash');
    await processedEvents.claimProcessing(PaymentProvider.STRIPE, 'evt_crash');

    await prisma.processedEvent.update({
      where: {
        provider_eventId: {
          provider: PaymentProvider.STRIPE,
          eventId: 'evt_crash',
        },
      },
      data: {
        processingStartedAt: new Date(Date.now() - 20 * 60 * 1000),
      },
    });

    const reaped = await reaper.runOnce();
    expect(reaped).toBe(1);

    await queue.add(WEBHOOK_JOB, {
      provider: PaymentProvider.STRIPE,
      eventId: 'evt_crash',
    });

    await waitForStatus('evt_crash', 'PROCESSED');

    const crashLedgerCount = await prisma.ledgerEntry.count({
      where: { paymentIntentId: crashIntent.body.id },
    });
    expect(crashLedgerCount).toBe(1);

    const receiptCount = await prisma.paymentReceipt.count({
      where: { provider: PaymentProvider.STRIPE, providerEventId: 'evt_crash' },
    });
    expect(receiptCount).toBe(1);

    const finalIntent = await prisma.paymentIntent.findUnique({
      where: { id: intentResponse.body.id },
    });

    expect(finalIntent?.status).toBe('SUCCEEDED');
  });

  it('serializes BigInt amounts in responses', async () => {
    const intentResponse = await request(app.getHttpServer())
      .post('/payments/intents')
      .send({
        amount: '9007199254740993',
        currency: 'usd',
        provider: 'STRIPE',
        providerReference: 'pi_bigint',
      })
      .expect(201);

    const fetchResponse = await request(app.getHttpServer())
      .get(`/payments/intents/${intentResponse.body.id}`)
      .expect(200);

    expect(typeof fetchResponse.body.amount).toBe('string');
    expect(fetchResponse.body.amount).toBe('9007199254740993');
  });
});
