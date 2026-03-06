export class CreatePaymentIntentDto {
  amount!: string;
  currency!: string;
  provider?: string;
  providerReference?: string;
}
