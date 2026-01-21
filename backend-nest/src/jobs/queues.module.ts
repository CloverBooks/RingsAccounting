import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { URL } from 'url';
import { WEBHOOK_QUEUE } from './queues';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        const url = new URL(redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || '6379'),
            password: url.password || undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
