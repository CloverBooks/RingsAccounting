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
  const app = (await NestFactory.create(
    AppModule,
    new FastifyAdapter({ logger: false }) as any,
    { bufferLogs: true },
  )) as NestFastifyApplication;

  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new BigIntSerializationInterceptor());

  await app.register(helmet as any, { global: true } as any);
  await app.register(cors as any, {
    origin: process.env.CORS_ALLOWED_ORIGINS?.split(',') ?? true,
    credentials: true,
  } as any);
  await app.register(rateLimit as any, { max: 100, timeWindow: '1 minute' } as any);
  await app.register(rawBody as any, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
    routes: ['/webhooks/stripe', '/webhooks/flutterwave'],
  } as any);

  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
