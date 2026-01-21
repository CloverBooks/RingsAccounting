import { BadRequestException } from '@nestjs/common';
import { LedgerService } from './ledger.service';

describe('LedgerService', () => {
  it('enforces postings sum to zero', async () => {
    const prisma = {
      ledgerEntry: {
        create: jest.fn(),
      },
    } as any;

    const service = new LedgerService(prisma);

    await expect(
      service.postEntry('intent-1', [
        { account: 'cash', amount: 100n },
        { account: 'revenue', amount: -50n },
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('prevents updates to posted entries', async () => {
    const prisma = {
      ledgerEntry: {
        create: jest.fn(),
      },
    } as any;

    const service = new LedgerService(prisma);

    await expect(service.updateEntry()).rejects.toThrow('immutable');
  });
});
