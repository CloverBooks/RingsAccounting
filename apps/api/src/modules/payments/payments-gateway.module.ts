import { Module } from '@nestjs/common';
import { StripeAdapter } from './stripe.adapter';
import { FlutterwaveAdapter } from './flutterwave.adapter';

@Module({
  providers: [StripeAdapter, FlutterwaveAdapter],
  exports: [StripeAdapter, FlutterwaveAdapter],
})
export class PaymentsGatewayModule {}
