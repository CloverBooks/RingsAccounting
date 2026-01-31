import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Redis from 'ioredis';

@Injectable()
export class HealthService {
  private readonly redis: Redis;

  constructor(private readonly prisma: PrismaService) {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  async checkReady() {
    await this.prisma.$queryRaw`SELECT 1`;
    await this.redis.ping();
  }
}
