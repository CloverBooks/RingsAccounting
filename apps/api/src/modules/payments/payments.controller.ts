import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('payments/intents')
  async createIntent(
    @Body()
    body: {
      org_id?: string;
      intent_type?: string;
      amount?: number | string;
      currency?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.paymentsService.createIntentCompatibility(body);
  }

  @Get('payments/intents/:id')
  async getIntent(@Param('id') id: string) {
    return this.paymentsService.getIntentCompatibility(id);
  }

  @Post('rw/bills/validate')
  async validateBill(@Body() body: { item_code?: string; customer?: string }) {
    return this.paymentsService.validateCompatibility(body);
  }

  @Post('rw/bills/pay')
  async payBill(@Body() body: Record<string, unknown>) {
    return this.paymentsService.payCompatibility(body);
  }
}
