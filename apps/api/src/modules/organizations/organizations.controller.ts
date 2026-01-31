import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { StripeAdapter } from '../payments/stripe.adapter';
import { FlutterwaveAdapter } from '../payments/flutterwave.adapter';

@ApiTags('organizations')
@Controller('orgs')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly stripeAdapter: StripeAdapter,
    private readonly flutterwaveAdapter: FlutterwaveAdapter,
  ) {}

  @Post()
  async createOrg(
    @Body()
    body: { legal_name: string; country: 'US' | 'CA' | 'RW'; tax_id_encrypted?: string },
  ) {
    return this.organizationsService.createOrganization(body);
  }

  @Post(':id/stripe/connect/onboard')
  async createStripeOnboarding(@Param('id') id: string) {
    const account = await this.stripeAdapter.createConnectAccountExpress();
    await this.organizationsService.attachStripeAccount(id, account.id);
    const link = await this.stripeAdapter.createAccountOnboardingLink(account.id);
    return { account_id: account.id, onboarding_url: link.url };
  }

  @Post(':id/flutterwave/onboard')
  async createFlutterwaveOnboarding(@Param('id') id: string) {
    const merchantId = await this.flutterwaveAdapter.createMerchantStub();
    await this.organizationsService.attachFlutterwaveMerchant(id, merchantId);
    return { merchant_id: merchantId };
  }
}
