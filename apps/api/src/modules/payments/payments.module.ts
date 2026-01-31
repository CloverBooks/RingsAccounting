import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsGatewayModule } from './payments-gateway.module';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PaymentsGatewayModule, LedgerModule, NotificationsModule],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
