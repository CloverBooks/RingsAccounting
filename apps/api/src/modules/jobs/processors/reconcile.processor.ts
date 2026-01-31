import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentsService } from '../../payments/payments.service';

@Processor('payments.reconcile')
export class ReconcileProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {
    super();
  }

  async process(job: Job) {
    if (job.name !== 'reconcile_pending_intents') {
      return;
    }
    const pending = await this.prisma.paymentIntent.findMany({
      where: { status: 'PENDING' },
      take: 50,
    });

    for (const intent of pending) {
      await this.paymentsService.transitionStatus(intent.id, 'PENDING');
    }
  }
}
