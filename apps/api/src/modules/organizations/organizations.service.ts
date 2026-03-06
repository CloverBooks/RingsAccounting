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
}
