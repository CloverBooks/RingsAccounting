import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FlutterwaveAdapter } from './flutterwave.adapter';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly prisma: PrismaService,
    private readonly flutterwaveAdapter: FlutterwaveAdapter,
  ) {}

  @Post('payments/intents')
  async createIntent(
    @Body()
    body: {
      org_id: string;
      intent_type: 'SUBSCRIPTION' | 'MERCHANT_INVOICE_COLLECTION' | 'RW_MOMO_COLLECTION' | 'RW_BILLPAY';
      amount: number;
      currency: 'USD' | 'CAD' | 'RWF';
      metadata?: Record<string, unknown>;
    },
  ) {
    const intent = await this.paymentsService.createPaymentIntent({
      orgId: body.org_id,
      intentType: body.intent_type,
      amount: body.amount,
      currency: body.currency,
      metadata: body.metadata,
    });
    return { payment_intent: intent, next_action: 'pending' };
  }

  @Get('payments/intents/:id')
  async getIntent(@Param('id') id: string) {
    return this.prisma.paymentIntent.findUnique({ where: { id } });
  }

  @Post('rw/bills/validate')
  async validateBill(@Body() body: { item_code: string; customer: string }) {
    return this.flutterwaveAdapter.billsValidate(body.item_code, body.customer);
  }

  @Post('rw/bills/pay')
  async payBill(@Body() body: Record<string, unknown>) {
    return this.flutterwaveAdapter.billsPay(body);
  }
}
