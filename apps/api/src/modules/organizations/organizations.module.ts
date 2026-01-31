import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { PaymentsGatewayModule } from '../payments/payments-gateway.module';

@Module({
  imports: [PaymentsGatewayModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
