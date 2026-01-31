import { WebhooksService } from '../src/modules/webhooks/webhooks.service';
import { StripeAdapter } from '../src/modules/payments/stripe.adapter';
import { FlutterwaveAdapter } from '../src/modules/payments/flutterwave.adapter';

const createPrismaMock = () => ({
  processedEvent: {
    create: jest.fn(),
  },
  webhookEvent: {
    create: jest.fn(),
  },
});

describe('Webhook idempotency', () => {
  it('dedupes duplicate provider events', async () => {
    const prisma = createPrismaMock();
    const stripeAdapter = { verifyWebhook: jest.fn().mockReturnValue({ id: 'evt_1', data: { object: { id: 'pi_1' } } }) } as unknown as StripeAdapter;
    const flutterwaveAdapter = new FlutterwaveAdapter();
    const queue = { add: jest.fn() };

    prisma.processedEvent.create.mockResolvedValueOnce({});
    prisma.processedEvent.create.mockRejectedValueOnce(new Error('Unique constraint'));

    const service = new WebhooksService(prisma as any, stripeAdapter, flutterwaveAdapter, queue as any);

    await service.handleStripeWebhook(Buffer.from('payload'), 'sig', {});
    const second = await service.handleStripeWebhook(Buffer.from('payload'), 'sig', {});

    expect(second).toEqual({ deduped: true });
    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});
