import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@InjectQueue('notifications.send') private readonly queue: Queue) {}

  async enqueueNotification(event: string, payload: Record<string, unknown>) {
    this.logger.log(`Queueing notification event=${event}`);
    await this.queue.add(event, payload);
  }
}
