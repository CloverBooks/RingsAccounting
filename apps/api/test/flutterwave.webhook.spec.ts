import { WebhooksService } from '../src/modules/webhooks/webhooks.service';

describe('Flutterwave webhook compatibility', () => {
  it('always acknowledges endpoint in disabled mode', () => {
    const service = new WebhooksService();
    const result = service.handleFlutterwaveWebhook(Buffer.from('{"event":"test"}'), {
      id: 'evt_1',
      state: 'test',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('disabled');
    expect(result.provider).toBe('flutterwave');
    expect(result.received).toBe(true);
  });
});
