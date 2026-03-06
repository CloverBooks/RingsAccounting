import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const redis = new URL(redisUrl);

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: redis.hostname,
        port: Number(redis.port),
        password: redis.password || undefined,
      },
    }),
    BullModule.registerQueue(
      { name: 'notifications.send' },
    ),
  ],
  providers: [],
  exports: [BullModule],
})
export class JobsModule {}
