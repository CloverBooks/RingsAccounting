import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, LedgerEntry } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface LedgerLineInput {
  account: string;
  amount: bigint;
}

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async postEntry(
    paymentIntentId: string,
    lines: LedgerLineInput[],
    client?: PrismaClientLike,
  ): Promise<LedgerEntry> {
    const total = lines.reduce((sum, line) => sum + line.amount, 0n);
    if (total !== 0n) {
      throw new BadRequestException('Ledger lines must sum to zero');
    }

    const prisma = client ?? this.prisma;

    return prisma.ledgerEntry.create({
      data: {
        paymentIntentId,
        lines: {
          create: lines.map((line) => ({
            account: line.account,
            amount: line.amount,
          })),
        },
      },
    });
  }

  async updateEntry(): Promise<void> {
    throw new BadRequestException('Ledger entries are immutable');
  }
}
