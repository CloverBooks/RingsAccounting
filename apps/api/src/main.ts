import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import rawBodyPlugin from 'fastify-raw-body';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { createLogger } from './common/utils/logger';
import { initializeTelemetry } from './telemetry/otel';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';

const bootstrap = async () => {
  const sdk = initializeTelemetry();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: createLogger() as any }),
  );

  await app.register(rawBodyPlugin, {
    field: 'rawBody',
    global: false,
    runFirst: true,
  });

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  });

  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      const allowed = (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean);
      if (!origin || allowed.length === 0 || allowed.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  await app.register(rateLimit, { global: false });
  app.useGlobalInterceptors(new BigIntInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Clover Books API')
    .setDescription('Clover Books Financial OS API')
    .setVersion('0.1')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });

  const shutdown = async () => {
    await app.close();
    await sdk.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

bootstrap();
