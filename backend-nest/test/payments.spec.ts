import { PaymentsController } from '../src/payments/payments.controller';
import { PaymentsService } from '../src/payments/payments.service';
import { WebhooksController } from '../src/webhooks/webhooks.controller';

describe('Compatibility endpoints', () => {
  it('returns disabled envelope for intent routes', () => {
    const service = new PaymentsService();
    const controller = new PaymentsController(service);

    const createResponse = controller.createIntent({
      amount: '1000',
      currency: 'USD',
      provider: 'LEGACY',
    });
    const getResponse = controller.getIntent('test-intent');

    expect(createResponse.ok).toBe(true);
    expect(createResponse.status).toBe('disabled');
    expect(getResponse.ok).toBe(true);
    expect(getResponse.status).toBe('disabled');
    expect(getResponse.payment_intent.id).toBe('test-intent');
  });

  it('returns disabled envelope for webhook routes', () => {
    const controller = new WebhooksController();
    const stripeResponse = controller.handleStripe({ rawBody: Buffer.from('x') } as any);
    const fallbackResponse = controller.handleFlutterwave({ rawBody: Buffer.from('x') } as any);

    expect(stripeResponse.ok).toBe(true);
    expect(stripeResponse.status).toBe('disabled');
    expect(stripeResponse.provider).toBe('stripe');
    expect(fallbackResponse.ok).toBe(true);
    expect(fallbackResponse.status).toBe('disabled');
    expect(fallbackResponse.provider).toBe('flutterwave');
  });
});
