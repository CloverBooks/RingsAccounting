import { createHmac } from 'crypto';
import { FlutterwaveWebhookService } from './flutterwave-webhook.service';

describe('FlutterwaveWebhookService', () => {
  const secret = 'flw_secret_hash';
  let service: FlutterwaveWebhookService;

  beforeEach(() => {
    process.env.FLW_SECRET_HASH = secret;
    service = new FlutterwaveWebhookService();
  });

  it('accepts valid verif-hash header', () => {
    const rawBody = Buffer.from('{"id":"evt_1"}');
    const result = service.verify(rawBody, { 'verif-hash': secret });
    expect(result).toBe(true);
  });

  it('rejects invalid verif-hash header', () => {
    const rawBody = Buffer.from('{"id":"evt_1"}');
    const result = service.verify(rawBody, { 'verif-hash': 'invalid' });
    expect(result).toBe(false);
  });

  it('accepts valid flutterwave-signature header', () => {
    const rawBody = Buffer.from('{"id":"evt_1"}');
    const signature = createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    const result = service.verify(rawBody, { 'flutterwave-signature': signature });
    expect(result).toBe(true);
  });

  it('rejects invalid flutterwave-signature header', () => {
    const rawBody = Buffer.from('{"id":"evt_1"}');
    const result = service.verify(rawBody, { 'flutterwave-signature': 'bad' });
    expect(result).toBe(false);
  });
});
