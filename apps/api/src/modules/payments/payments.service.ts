import { Injectable } from '@nestjs/common';
import { PaymentIntentStatus, PaymentIntent, WebhookProvider } from '@prisma/client';
import crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { CanadaPadPolicy } from './canada-pad.policy';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsRouter } from './payments.router';

@Injectable()
export class PaymentsService {
  private readonly router = new PaymentsRouter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createPaymentIntent(dto: {
    orgId: string;
    intentType: PaymentIntent['intent_type'];
    amount: number;
    currency: PaymentIntent['currency'];
    metadata?: Record<string, unknown>;
  }) {
    const org = await this.prisma.organization.findUnique({ where: { id: dto.orgId } });
    if (!org) {
      throw new Error('Organization not found');
    }
    const route = this.router.route(org.country, dto.intentType, dto.currency);

    const intent = await this.prisma.paymentIntent.create({
      data: {
        org_id: dto.orgId,
        direction: dto.intentType === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'AR',
        intent_type: dto.intentType,
        provider: route.provider,
        rail: route.rail,
        amount: BigInt(dto.amount),
        currency: dto.currency,
        status: PaymentIntentStatus.CREATED,
        idempotency_key: crypto.randomUUID(),
        metadata: dto.metadata ?? {},
      },
    });

    if (org.country === 'CA' && dto.intentType === 'MERCHANT_INVOICE_COLLECTION') {
      const policy = new CanadaPadPolicy(Number(process.env.CA_PAD_NOTICE_DAYS ?? 10));
      const policyResult = policy.applyVariablePadPolicy({
        country: org.country,
        padWaiverActive: org.pad_waiver_active,
        variableAmount: true,
      });
      if (policyResult.requiresPreNotification) {
        await this.notificationsService.sendPadPreNotification({
          orgId: org.id,
          scheduledFor: policyResult.scheduleAt?.toISOString(),
        });
      }
    }

    return intent;
  }

  async transitionStatus(intentId: string, status: PaymentIntentStatus) {
    return this.prisma.paymentIntent.update({
      where: { id: intentId },
      data: { status },
    });
  }

  async finalizeFromWebhook(provider: WebhookProvider, event: any) {
    const providerRef = this.extractProviderRef(provider, event);
    if (!providerRef) {
      return null;
    }

    const intent = await this.prisma.paymentIntent.findFirst({
      where: { provider_ref: providerRef },
    });
    if (!intent) {
      return null;
    }

    const status = this.mapProviderStatus(provider, event);
    const updated = await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status },
    });

    await this.prisma.paymentReceipt.create({
      data: {
        payment_intent_id: intent.id,
        type: 'GENERIC',
        payload: event,
      },
    });

    return updated;
  }

  private extractProviderRef(provider: WebhookProvider, event: any) {
    if (provider === 'STRIPE') {
      return event?.data?.object?.id;
    }
    if (provider === 'FLUTTERWAVE') {
      return event?.data?.id ?? event?.data?.tx_ref;
    }
    return null;
  }

  private mapProviderStatus(provider: WebhookProvider, event: any): PaymentIntentStatus {
    if (provider === 'STRIPE') {
      const status = event?.data?.object?.status;
      if (status === 'succeeded') return PaymentIntentStatus.SUCCEEDED;
      if (status === 'requires_action') return PaymentIntentStatus.REQUIRES_ACTION;
      if (status === 'processing') return PaymentIntentStatus.PENDING;
      return PaymentIntentStatus.FAILED;
    }

    const flwStatus = event?.data?.status;
    if (flwStatus === 'successful') return PaymentIntentStatus.SUCCEEDED;
    if (flwStatus === 'pending') return PaymentIntentStatus.PENDING;
    return PaymentIntentStatus.FAILED;
  }
}
