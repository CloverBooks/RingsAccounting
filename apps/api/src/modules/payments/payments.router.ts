export type IntentType =
  | 'SUBSCRIPTION'
  | 'MERCHANT_INVOICE_COLLECTION'
  | 'RW_MOMO_COLLECTION'
  | 'RW_BILLPAY';

export type Country = 'US' | 'CA' | 'RW';
export type PaymentProvider = 'STRIPE' | 'FLUTTERWAVE';
export type PaymentRail = 'CARD' | 'US_ACH' | 'CA_ACSS' | 'RW_MOMO' | 'RW_BILLS';

export type PaymentRoute = {
  provider: PaymentProvider;
  rail: PaymentRail;
};

export class PaymentsRouter {
  route(country: Country, intentType: IntentType, currency: 'USD' | 'CAD' | 'RWF'): PaymentRoute {
    if (country === 'RW') {
      if (intentType === 'RW_BILLPAY') {
        return { provider: 'FLUTTERWAVE', rail: 'RW_BILLS' };
      }
      return { provider: 'FLUTTERWAVE', rail: 'RW_MOMO' };
    }

    if (intentType === 'SUBSCRIPTION') {
      return { provider: 'STRIPE', rail: 'CARD' };
    }

    if (currency === 'CAD') {
      return { provider: 'STRIPE', rail: 'CA_ACSS' };
    }

    return { provider: 'STRIPE', rail: 'US_ACH' };
  }
}
