import { PaymentRouterService } from './payment-router.service';

describe('PaymentRouterService', () => {
  let service: PaymentRouterService;

  beforeEach(() => {
    service = new PaymentRouterService();
  });

  it('routes US invoice collection to Stripe direct charge', () => {
    const result = service.route({
      country: 'US',
      collectionMethod: 'INVOICE',
    });

    expect(result).toEqual({ provider: 'STRIPE', rail: 'DIRECT_CHARGE' });
  });

  it('routes CA invoice collection to Stripe direct charge', () => {
    const result = service.route({
      country: 'CA',
      collectionMethod: 'INVOICE',
    });

    expect(result).toEqual({ provider: 'STRIPE', rail: 'DIRECT_CHARGE' });
  });

  it('routes RW momo to Flutterwave momo rail', () => {
    const result = service.route({
      country: 'RW',
      collectionMethod: 'DIRECT',
      railHint: 'MOMO',
    });

    expect(result).toEqual({ provider: 'FLUTTERWAVE', rail: 'MOMO' });
  });

  it('routes RW bills to Flutterwave bills rail', () => {
    const result = service.route({
      country: 'RW',
      collectionMethod: 'DIRECT',
      railHint: 'BILLS',
    });

    expect(result).toEqual({ provider: 'FLUTTERWAVE', rail: 'BILLS' });
  });
});
