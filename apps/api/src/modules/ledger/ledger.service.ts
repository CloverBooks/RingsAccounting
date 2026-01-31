import { Injectable } from '@nestjs/common';
import { Prisma, JournalEntryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          ledger_id: dto.ledgerId,
          description: dto.description,
          external_reference: dto.externalReference ?? null,
          idempotency_key: dto.idempotencyKey,
          status: JournalEntryStatus.PENDING,
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
        data: { status: JournalEntryStatus.POSTED, posted_at: new Date() },
      });

      return posted;
    });
  }

  async updateEntry(entryId: string, data: Prisma.JournalEntryUpdateInput) {
    const entry = await this.prisma.journalEntry.findUnique({ where: { id: entryId } });
    if (!entry) {
      throw new Error('Entry not found');
    }
    if (entry.status === JournalEntryStatus.POSTED) {
      throw new Error('Posted journal entries are immutable.');
    }
    return this.prisma.journalEntry.update({ where: { id: entryId }, data });
  }
}
