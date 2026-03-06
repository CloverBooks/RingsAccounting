import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { disabledResponse } from '../common/compatibility-response';

@Controller('webhooks')
export class WebhooksController {
  private readonly message =
    'Webhook ingestion is disabled in the current backend profile.';

  @Post('stripe')
  @HttpCode(200)
  handleStripe(@Req() request: FastifyRequest) {
    const rawBody = request.rawBody;
    const rawBuffer = rawBody
      ? Buffer.isBuffer(rawBody)
        ? rawBody
        : Buffer.from(rawBody)
      : Buffer.from('');

    return disabledResponse(this.message, {
      provider: 'stripe',
      received: true,
      size_bytes: rawBuffer.length,
    });
  }

  @Post('flutterwave')
  @HttpCode(200)
  handleFlutterwave(@Req() request: FastifyRequest) {
    const rawBody = request.rawBody;
    const rawBuffer = rawBody
      ? Buffer.isBuffer(rawBody)
        ? rawBody
        : Buffer.from(rawBody)
      : Buffer.from('');

    return disabledResponse(this.message, {
      provider: 'flutterwave',
      received: true,
      size_bytes: rawBuffer.length,
    });
  }
}
