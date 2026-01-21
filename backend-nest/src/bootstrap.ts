import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import rawBody from 'fastify-raw-body';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { BigIntSerializationInterceptor } from './common/interceptors/bigint-serialization.interceptor';
import { initTelemetry } from './telemetry/telemetry';

export async function createApp(): Promise<NestFastifyApplication> {
  await initTelemetry();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new BigIntSerializationInterceptor());

  await app.register(helmet, { global: true });
  await app.register(cors, {
    origin: process.env.CORS_ALLOWED_ORIGINS?.split(',') ?? true,
    credentials: true,
  });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(rawBody, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
    routes: ['/webhooks/stripe', '/webhooks/flutterwave'],
  });

  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
