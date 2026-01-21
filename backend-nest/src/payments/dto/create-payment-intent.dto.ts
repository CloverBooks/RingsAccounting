export class CreatePaymentIntentDto {
  amount!: string;
  currency!: string;
  provider!: 'STRIPE' | 'FLUTTERWAVE';
  providerReference?: string;
}
