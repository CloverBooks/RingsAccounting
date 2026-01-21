import { Injectable } from '@nestjs/common';

@Injectable()
export class OrganizationsService {
  getStatus(): { status: string } {
    return { status: 'ok' };
  }
}
