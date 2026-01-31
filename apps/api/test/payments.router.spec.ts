import { PaymentsRouter } from '../src/modules/payments/payments.router';

describe('PaymentsRouter', () => {
  it('routes Rwanda intents to Flutterwave', () => {
    const router = new PaymentsRouter();
    const route = router.route('RW', 'RW_MOMO_COLLECTION', 'RWF');
    expect(route).toEqual({ provider: 'FLUTTERWAVE', rail: 'RW_MOMO' });
  });

  it('routes subscription in US to Stripe card', () => {
    const router = new PaymentsRouter();
    const route = router.route('US', 'SUBSCRIPTION', 'USD');
    expect(route).toEqual({ provider: 'STRIPE', rail: 'CARD' });
  });
});
