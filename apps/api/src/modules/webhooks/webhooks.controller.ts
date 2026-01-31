import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('stripe', {
    config: {
      rawBody: true,
      rateLimit: { max: 30, timeWindow: '1 minute' },
      bodyLimit: 1024 * 1024,
    },
  })
  @HttpCode(200)
  async stripeWebhook(@Req() req: FastifyRequest & { rawBody?: Buffer }, @Headers('stripe-signature') signature?: string) {
    const rawBody = req.rawBody ?? Buffer.from('');
    await this.webhooksService.handleStripeWebhook(rawBody, signature, req.headers);
    return { received: true };
  }

  @Post('flutterwave', {
    config: {
      rawBody: true,
      rateLimit: { max: 30, timeWindow: '1 minute' },
      bodyLimit: 1024 * 1024,
    },
  })
  @HttpCode(200)
  async flutterwaveWebhook(
    @Req() req: FastifyRequest & { rawBody?: Buffer },
    @Body() body: any,
  ) {
    const rawBody = req.rawBody ?? Buffer.from('');
    await this.webhooksService.handleFlutterwaveWebhook(rawBody, req.headers, body);
    return { received: true };
  }
}
