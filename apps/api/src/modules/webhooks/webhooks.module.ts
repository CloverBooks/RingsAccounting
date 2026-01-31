import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { PaymentsGatewayModule } from '../payments/payments-gateway.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    PaymentsGatewayModule,
    BullModule.registerQueue({ name: 'webhook.ingress' }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
