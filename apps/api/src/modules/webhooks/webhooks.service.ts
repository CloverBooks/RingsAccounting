import { Injectable } from '@nestjs/common';
import { disabledResponse } from '../../common/utils/compatibility';

@Injectable()
export class WebhooksService {
  handleStripeWebhook(rawBody: Buffer) {
    return disabledResponse(
      'Webhook ingestion is disabled in the current backend profile.',
      {
        provider: 'stripe',
        size_bytes: rawBody.length,
        received: true,
      },
    );
  }

  handleFlutterwaveWebhook(rawBody: Buffer, payload: any) {
    return disabledResponse(
      'Webhook ingestion is disabled in the current backend profile.',
      {
        provider: 'flutterwave',
        size_bytes: rawBody.length,
        received: true,
        payload_preview:
          payload && typeof payload === 'object'
            ? Object.keys(payload).slice(0, 5)
            : [],
      },
    );
  }
}
