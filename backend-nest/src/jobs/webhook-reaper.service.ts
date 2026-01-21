import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ProcessedEventsService } from '../webhooks/processed-events.service';

@Injectable()
export class WebhookReaperService {
  constructor(
    private readonly processedEventsService: ProcessedEventsService,
    private readonly configService: ConfigService,
  ) {}

  @Interval(60_000)
  async reap(): Promise<void> {
    await this.runOnce();
  }

  async runOnce(): Promise<number> {
    const timeoutMinutes = Number(
      this.configService.get('WEBHOOK_PROCESSING_TIMEOUT_MINUTES') ?? 10,
    );

    return this.processedEventsService.reapStuck(timeoutMinutes);
  }
}
