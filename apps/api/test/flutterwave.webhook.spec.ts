import crypto from 'crypto';
import { FlutterwaveAdapter } from '../src/modules/payments/flutterwave.adapter';

describe('FlutterwaveAdapter webhook verification', () => {
  const secretHash = 'secret_hash';
  const rawBody = Buffer.from('{"event":"test"}');

  beforeEach(() => {
    process.env.FLW_SECRET_HASH = secretHash;
  });

  it('accepts valid verif-hash header', () => {
    const adapter = new FlutterwaveAdapter();
    const result = adapter.verifyWebhook(rawBody, { 'verif-hash': secretHash });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid verif-hash header', () => {
    const adapter = new FlutterwaveAdapter();
    const result = adapter.verifyWebhook(rawBody, { 'verif-hash': 'bad' });
    expect(result.valid).toBe(false);
  });

  it('accepts valid flutterwave-signature header', () => {
    const signature = crypto.createHmac('sha256', secretHash).update(rawBody).digest('base64');
    const adapter = new FlutterwaveAdapter();
    const result = adapter.verifyWebhook(rawBody, { 'flutterwave-signature': signature });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid flutterwave-signature header', () => {
    const adapter = new FlutterwaveAdapter();
    const result = adapter.verifyWebhook(rawBody, { 'flutterwave-signature': 'bad' });
    expect(result.valid).toBe(false);
  });
});
