import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { disabledResponse } from '../../common/utils/compatibility';

@ApiTags('organizations')
@Controller('orgs')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  async createOrg(
    @Body()
    body: { legal_name: string; country: 'US' | 'CA' | 'RW'; tax_id_encrypted?: string },
  ) {
    return this.organizationsService.createOrganization(body);
  }

  @Post(':id/stripe/connect/onboard')
  async createStripeOnboarding(@Param('id') id: string) {
    return disabledResponse(
      'Provider onboarding is disabled in the current backend profile.',
      {
        organization_id: id,
        account_id: null,
        onboarding_url: null,
      },
    );
  }

  @Post(':id/flutterwave/onboard')
  async createFlutterwaveOnboarding(@Param('id') id: string) {
    return disabledResponse(
      'Provider onboarding is disabled in the current backend profile.',
      {
        organization_id: id,
        merchant_id: null,
      },
    );
  }
}
