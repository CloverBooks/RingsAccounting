export type PaymentRail = 'DIRECT_CHARGE' | 'MOMO' | 'BILLS';

export interface PaymentRouteRequest {
  country: string;
  collectionMethod: 'INVOICE' | 'DIRECT';
  railHint?: PaymentRail;
}

export interface PaymentRouteResult {
  provider: 'STRIPE' | 'FLUTTERWAVE';
  rail: PaymentRail;
}

import { Injectable } from '@nestjs/common';

@Injectable()
export class PaymentRouterService {
  route(request: PaymentRouteRequest): PaymentRouteResult {
    const country = request.country.toUpperCase();

    if (['US', 'CA'].includes(country) && request.collectionMethod === 'INVOICE') {
      return { provider: 'STRIPE', rail: 'DIRECT_CHARGE' };
    }

    if (country === 'RW' && request.railHint) {
      return { provider: 'FLUTTERWAVE', rail: request.railHint };
    }

    return { provider: 'STRIPE', rail: 'DIRECT_CHARGE' };
  }
}
