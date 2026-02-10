import { LedgerService } from '../src/modules/ledger/ledger.service';

const createPrismaMock = () => ({
  $transaction: jest.fn(),
  journalEntry: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  posting: {
    createMany: jest.fn(),
  },
});

describe('LedgerService', () => {
  it('enforces postings to balance to zero', async () => {
    const prisma = createPrismaMock();
    const service = new LedgerService(prisma as any);

    await expect(
      service.createEntryAtomic({
        ledgerId: 'ledger',
        description: 'test',
        idempotencyKey: 'key',
        postings: [
          { accountId: 'a', amount: BigInt(100) },
          { accountId: 'b', amount: BigInt(-50) },
        ],
      }),
    ).rejects.toThrow('Postings must balance to zero.');
  });

  it('rejects updates to posted entries', async () => {
    const prisma = createPrismaMock();
    prisma.journalEntry.findUnique.mockResolvedValue({
      id: 'entry',
      status: 'POSTED',
    });

    const service = new LedgerService(prisma as any);
    await expect(service.updateEntry('entry', {})).rejects.toThrow(
      'Posted journal entries are immutable.',
    );
  });
});
