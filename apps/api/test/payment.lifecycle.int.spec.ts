import { PaymentsService } from '../src/modules/payments/payments.service';

describe('Payment compatibility lifecycle', () => {
  it('keeps get-intent shape in disabled mode', () => {
    const service = new PaymentsService();
    const result = service.getIntentCompatibility('intent-1');

    expect(result.ok).toBe(true);
    expect(result.status).toBe('disabled');
    expect(result.payment_intent.id).toBe('intent-1');
    expect(result.payment_intent.status).toBe('disabled');
  });

  it('returns disabled response for bill APIs', () => {
    const service = new PaymentsService();
    const validation = service.validateCompatibility({ item_code: 'A1', customer: '123' });
    const pay = service.payCompatibility({ item_code: 'A1', customer: '123' });

    expect(validation.ok).toBe(true);
    expect(validation.status).toBe('disabled');
    expect(pay.ok).toBe(true);
    expect(pay.status).toBe('disabled');
  });
});
