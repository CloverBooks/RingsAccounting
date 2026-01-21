import { Injectable } from '@nestjs/common';
import { PaymentProvider, ProcessedEvent, ProcessedEventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProcessedEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureReceived(
    provider: PaymentProvider,
    eventId: string,
  ): Promise<ProcessedEvent> {
    try {
      return await this.prisma.processedEvent.create({
        data: {
          provider,
          eventId,
          status: ProcessedEventStatus.RECEIVED,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const existing = await this.prisma.processedEvent.findUnique({
            where: { provider_eventId: { provider, eventId } },
          });
          if (existing) {
            return existing;
          }
        }
      }
      throw error;
    }
  }

  async claimProcessing(
    provider: PaymentProvider,
    eventId: string,
  ): Promise<ProcessedEvent | null> {
    const rows = await this.prisma.$queryRaw<ProcessedEvent[]>`
      UPDATE "ProcessedEvent"
      SET "status" = 'PROCESSING',
          "processingStartedAt" = NOW(),
          "updatedAt" = NOW()
      WHERE "provider" = ${provider}
        AND "eventId" = ${eventId}
        AND "status" = 'RECEIVED'
      RETURNING *
    `;

    return rows[0] ?? null;
  }

  async markProcessed(provider: PaymentProvider, eventId: string): Promise<void> {
    await this.prisma.processedEvent.update({
      where: { provider_eventId: { provider, eventId } },
      data: {
        status: ProcessedEventStatus.PROCESSED,
        processedAt: new Date(),
        processingStartedAt: null,
      },
    });
  }

  async markFailed(
    provider: PaymentProvider,
    eventId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.prisma.processedEvent.update({
      where: { provider_eventId: { provider, eventId } },
      data: {
        status: ProcessedEventStatus.FAILED,
        failedAt: new Date(),
        errorMessage,
        processingStartedAt: null,
      },
    });
  }

  async reapStuck(timeoutMinutes: number): Promise<number> {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60_000);
    const result = await this.prisma.processedEvent.updateMany({
      where: {
        status: ProcessedEventStatus.PROCESSING,
        processingStartedAt: { lt: cutoff },
      },
      data: {
        status: ProcessedEventStatus.RECEIVED,
        processingStartedAt: null,
      },
    });

    return result.count;
  }
}
