import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsController } from './payments.controller';
import { PaymentRouterService } from './payment-router.service';
import { PaymentsService } from './payments.service';

@Module({
  imports: [PrismaModule, LedgerModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentRouterService],
  exports: [PaymentsService, PaymentRouterService],
})
export class PaymentsModule {}
