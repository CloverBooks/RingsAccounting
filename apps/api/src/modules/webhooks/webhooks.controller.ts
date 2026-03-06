import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RouteConfig } from '@nestjs/platform-fastify';
import { FastifyRequest } from 'fastify';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @RouteConfig({
    config: {
      rawBody: true,
      rateLimit: { max: 30, timeWindow: '1 minute' },
      bodyLimit: 1024 * 1024,
    },
  })
  @Post('stripe')
  @HttpCode(200)
  async stripeWebhook(@Req() req: FastifyRequest & { rawBody?: Buffer }) {
    const rawBody = req.rawBody ?? Buffer.from('');
    return this.webhooksService.handleStripeWebhook(rawBody);
  }

  @RouteConfig({
    config: {
      rawBody: true,
      rateLimit: { max: 30, timeWindow: '1 minute' },
      bodyLimit: 1024 * 1024,
    },
  })
  @Post('flutterwave')
  @HttpCode(200)
  async flutterwaveWebhook(
    @Req() req: FastifyRequest & { rawBody?: Buffer },
    @Body() body: any,
  ) {
    const rawBody = req.rawBody ?? Buffer.from('');
    return this.webhooksService.handleFlutterwaveWebhook(rawBody, body);
  }
}
