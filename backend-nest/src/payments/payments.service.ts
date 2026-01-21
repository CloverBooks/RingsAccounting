import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentIntent, PaymentProvider, PaymentIntentStatus } from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

export interface PaymentWebhookPayload {
  providerReference: string;
  amount: bigint;
  currency: string;
  status: 'SUCCEEDED' | 'FAILED';
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  async createIntent(dto: CreatePaymentIntentDto): Promise<PaymentIntent> {
    const amount = BigInt(dto.amount);

    return this.prisma.paymentIntent.create({
      data: {
        amount,
        currency: dto.currency.toUpperCase(),
        provider: dto.provider as PaymentProvider,
        providerReference: dto.providerReference ?? null,
      },
    });
  }

  async getIntent(id: string): Promise<PaymentIntent> {
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id } });
    if (!intent) {
      throw new BadRequestException('Payment intent not found');
    }

    return intent;
  }

  async finalizeFromWebhook(
    provider: PaymentProvider,
    eventId: string,
    payload: PaymentWebhookPayload,
  ): Promise<PaymentIntent> {
    return this.prisma.$transaction(async (tx) => {
      const intent = await tx.paymentIntent.findFirst({
        where: {
          provider,
          OR: [
            { providerReference: payload.providerReference },
            { id: payload.providerReference },
          ],
        },
      });

      if (!intent) {
        throw new BadRequestException('Payment intent not found');
      }

      const receipt = await tx.paymentReceipt.findUnique({
        where: {
          provider_providerEventId: {
            provider,
            providerEventId: eventId,
          },
        },
      });

      if (receipt) {
        return intent;
      }

      const nextStatus =
        payload.status === 'SUCCEEDED'
          ? PaymentIntentStatus.SUCCEEDED
          : PaymentIntentStatus.FAILED;

      const updated = await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: nextStatus },
      });

      if (payload.status === 'SUCCEEDED') {
        await this.ledgerService.postEntry(
          intent.id,
          [
            { account: 'cash', amount: payload.amount },
            { account: 'revenue', amount: -payload.amount },
          ],
          tx,
        );
      }

      await tx.paymentReceipt.create({
        data: {
          paymentIntentId: intent.id,
          provider,
          providerEventId: eventId,
        },
      });

      return updated;
    });
  }
}
