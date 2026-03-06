import { PaymentsService } from '../src/modules/payments/payments.service';

describe('Payments compatibility', () => {
  it('returns disabled envelope for intent creation', () => {
    const service = new PaymentsService();
    const result = service.createIntentCompatibility({
      org_id: 'org-1',
      amount: 1000,
      currency: 'USD',
      metadata: { source: 'test' },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('disabled');
    expect(result.payment_intent.status).toBe('disabled');
    expect(result.next_action).toBe('none');
  });
});
