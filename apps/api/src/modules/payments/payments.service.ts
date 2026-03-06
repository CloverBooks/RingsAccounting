import { Injectable } from '@nestjs/common';
import { disabledResponse } from '../../common/utils/compatibility';

const DISABLED_MESSAGE = 'This capability is disabled in the current backend profile.';

@Injectable()
export class PaymentsService {
  createIntentCompatibility(body: {
    org_id?: string;
    intent_type?: string;
    amount?: number | string;
    currency?: string;
    metadata?: Record<string, unknown>;
  }) {
    return disabledResponse(DISABLED_MESSAGE, {
      payment_intent: {
        id: null,
        org_id: body.org_id ?? null,
        intent_type: body.intent_type ?? null,
        amount: body.amount ?? null,
        currency: body.currency ?? null,
        status: 'disabled',
        metadata: body.metadata ?? {},
      },
      next_action: 'none',
    });
  }

  getIntentCompatibility(id: string) {
    return disabledResponse(DISABLED_MESSAGE, {
      payment_intent: {
        id,
        status: 'disabled',
      },
    });
  }

  validateCompatibility(body: { item_code?: string; customer?: string }) {
    return disabledResponse(DISABLED_MESSAGE, {
      validation: {
        item_code: body.item_code ?? null,
        customer: body.customer ?? null,
        valid: false,
      },
    });
  }

  payCompatibility(body: Record<string, unknown>) {
    return disabledResponse(DISABLED_MESSAGE, {
      request: body,
      accepted: false,
    });
  }
}
