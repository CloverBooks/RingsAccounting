import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const JOURNAL_ENTRY_STATUS = {
  PENDING: 'PENDING',
  POSTED: 'POSTED',
} as const;

type JournalEntryUpdateInput = Record<string, unknown>;

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async createEntryAtomic(dto: {
    ledgerId: string;
    description: string;
    externalReference?: string | null;
    idempotencyKey: string;
    postings: Array<{ accountId: string; amount: bigint }>;
  }) {
    const total = dto.postings.reduce((sum, posting) => sum + posting.amount, BigInt(0));
    if (total !== BigInt(0)) {
      throw new Error('Postings must balance to zero.');
    }

    return this.prisma.$transaction(async (tx: any) => {
      const entry = await tx.journalEntry.create({
        data: {
          ledger_id: dto.ledgerId,
          description: dto.description,
          external_reference: dto.externalReference ?? null,
          idempotency_key: dto.idempotencyKey,
          status: JOURNAL_ENTRY_STATUS.PENDING,
        },
      });

      await tx.posting.createMany({
        data: dto.postings.map((posting) => ({
          journal_entry_id: entry.id,
          account_id: posting.accountId,
          amount: posting.amount,
        })),
      });

      const posted = await tx.journalEntry.update({
        where: { id: entry.id },
        data: { status: JOURNAL_ENTRY_STATUS.POSTED, posted_at: new Date() },
      });

      return posted;
    });
  }

  async updateEntry(entryId: string, data: JournalEntryUpdateInput) {
    const entry = await this.prisma.journalEntry.findUnique({ where: { id: entryId } });
    if (!entry) {
      throw new Error('Entry not found');
    }
    if (entry.status === JOURNAL_ENTRY_STATUS.POSTED) {
      throw new Error('Posted journal entries are immutable.');
    }
    return this.prisma.journalEntry.update({ where: { id: entryId }, data });
  }
}
