import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhookIngressProcessor } from './processors/webhook-ingress.processor';
import { PaymentsModule } from '../payments/payments.module';
import { ReconcileProcessor } from './processors/reconcile.processor';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const redis = new URL(redisUrl);

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: redis.hostname,
        port: Number(redis.port),
        password: redis.password || undefined,
      },
    }),
    BullModule.registerQueue(
      { name: 'webhook.ingress' },
      { name: 'payments.reconcile' },
      { name: 'ledger.post' },
      { name: 'notifications.send' },
    ),
    PaymentsModule,
  ],
  providers: [WebhookIngressProcessor, ReconcileProcessor],
  exports: [BullModule],
})
export class JobsModule {}
