import { Injectable } from '@nestjs/common';
import { PaymentProvider, Prisma, WebhookEvent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhookEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    provider: PaymentProvider,
    eventId: string,
    rawBody: Buffer,
    headers: Prisma.InputJsonValue,
  ): Promise<WebhookEvent> {
    return this.prisma.webhookEvent.create({
      data: {
        provider,
        eventId,
        rawBody,
        headers,
      },
    });
  }

  async getLatest(
    provider: PaymentProvider,
    eventId: string,
  ): Promise<WebhookEvent | null> {
    return this.prisma.webhookEvent.findFirst({
      where: { provider, eventId },
      orderBy: { receivedAt: 'desc' },
    });
  }
}
