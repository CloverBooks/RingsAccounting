import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { QueuesModule } from './queues.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { WebhookProcessor } from './webhook.processor';
import { WebhookReaperService } from './webhook-reaper.service';

@Module({
  imports: [QueuesModule, WebhooksModule, PaymentsModule],
  providers: [WebhookProcessor, WebhookReaperService],
})
export class JobsModule {}
