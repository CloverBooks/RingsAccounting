import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrganization(data: {
    legal_name: string;
    country: 'US' | 'CA' | 'RW';
    tax_id_encrypted?: string | null;
  }) {
    return this.prisma.organization.create({
      data: {
        legal_name: data.legal_name,
        country: data.country,
        tax_id_encrypted: data.tax_id_encrypted ?? null,
      },
    });
  }

  async attachStripeAccount(orgId: string, stripeAccountId: string) {
    return this.prisma.organization.update({
      where: { id: orgId },
      data: { stripe_account_id: stripeAccountId },
    });
  }

  async attachFlutterwaveMerchant(orgId: string, merchantId: string) {
    return this.prisma.organization.update({
      where: { id: orgId },
      data: { flutterwave_merchant_id: merchantId },
    });
  }
}
