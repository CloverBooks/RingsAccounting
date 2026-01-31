import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    LedgerModule,
    PaymentsModule,
    WebhooksModule,
    JobsModule,
    NotificationsModule,
    HealthModule,
  ],
})
export class AppModule {}
