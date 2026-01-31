import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PaymentsService } from '../../payments/payments.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Processor('webhook.ingress')
export class WebhookIngressProcessor extends WorkerHost {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<{ provider: 'STRIPE' | 'FLUTTERWAVE'; event: any }>) {
    const eventId = this.extractEventId(job.data.provider, job.data.event);
    if (eventId) {
      const updated = await this.prisma.processedEvent.updateMany({
        where: { provider: job.data.provider, event_id: eventId, status: 'RECEIVED' },
        data: { status: 'PROCESSED' },
      });
      if (updated.count === 0) {
        return;
      }
    }

    await this.paymentsService.finalizeFromWebhook(job.data.provider, job.data.event);
  }

  private extractEventId(provider: 'STRIPE' | 'FLUTTERWAVE', event: any) {
    if (provider === 'STRIPE') {
      return event?.id ?? null;
    }
    return event?.data?.id ? String(event.data.id) : null;
  }
}
