import { Injectable } from '@nestjs/common';
import { disabledResponse } from '../common/compatibility-response';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

const DISABLED_MESSAGE = 'This capability is disabled in the current backend profile.';

@Injectable()
export class PaymentsService {
  createIntent(dto: CreatePaymentIntentDto) {
    return disabledResponse(DISABLED_MESSAGE, {
      payment_intent: {
        id: null,
        provider: dto.provider ?? null,
        providerReference: dto.providerReference ?? null,
        amount: dto.amount ?? null,
        currency: dto.currency ?? null,
        status: 'disabled',
      },
    });
  }

  getIntent(id: string) {
    return disabledResponse(DISABLED_MESSAGE, {
      payment_intent: {
        id,
        status: 'disabled',
      },
    });
  }
}
