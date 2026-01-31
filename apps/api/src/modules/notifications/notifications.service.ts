import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@InjectQueue('notifications.send') private readonly queue: Queue) {}

  async sendPadPreNotification(payload: { orgId: string; scheduledFor?: string | null }) {
    this.logger.log(`Queueing PAD pre-notification for org ${payload.orgId}`);
    await this.queue.add('pad_pre_notification', payload);
  }

  async sendReceipt(payload: { orgId: string; paymentIntentId: string }) {
    this.logger.log(`Queueing receipt for ${payload.paymentIntentId}`);
    await this.queue.add('send_receipt', payload);
  }

  async sendRetryLinkRwanda(payload: { orgId: string; intentId: string }) {
    this.logger.log(`Queueing Rwanda retry link for ${payload.intentId}`);
    await this.queue.add('send_retry_link_rwanda', payload);
  }
}
