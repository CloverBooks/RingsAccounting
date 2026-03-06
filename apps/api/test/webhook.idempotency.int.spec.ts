import { WebhooksService } from '../src/modules/webhooks/webhooks.service';

describe('Webhook compatibility', () => {
  it('always acknowledges stripe endpoint in disabled mode', () => {
    const service = new WebhooksService();
    const result = service.handleStripeWebhook(Buffer.from('payload'));

    expect(result.ok).toBe(true);
    expect(result.status).toBe('disabled');
    expect(result.provider).toBe('stripe');
    expect(result.received).toBe(true);
  });
});
