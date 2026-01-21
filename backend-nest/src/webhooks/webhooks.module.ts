import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QueuesModule } from '../jobs/queues.module';
import { FlutterwaveWebhookService } from './flutterwave-webhook.service';
import { ProcessedEventsService } from './processed-events.service';
import { StripeWebhookService } from './stripe-webhook.service';
import { WebhookEventsService } from './webhook-events.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [PrismaModule, QueuesModule],
  controllers: [WebhooksController],
  providers: [
    StripeWebhookService,
    FlutterwaveWebhookService,
    ProcessedEventsService,
    WebhookEventsService,
  ],
  exports: [ProcessedEventsService, WebhookEventsService],
})
export class WebhooksModule {}
