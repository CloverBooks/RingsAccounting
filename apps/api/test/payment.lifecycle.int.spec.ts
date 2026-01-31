import { PaymentsService } from '../src/modules/payments/payments.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

const createPrismaMock = () => ({
  organization: {
    findUnique: jest.fn(),
  },
  paymentIntent: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  paymentReceipt: {
    create: jest.fn(),
  },
});

describe('PaymentIntent lifecycle', () => {
  it('creates and finalizes a payment intent', async () => {
    const prisma = createPrismaMock();
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org',
      country: 'US',
      pad_waiver_active: false,
    });
    prisma.paymentIntent.create.mockResolvedValue({
      id: 'intent',
      provider_ref: 'pi_123',
      status: 'CREATED',
    });

    const notifications = { sendPadPreNotification: jest.fn() } as unknown as NotificationsService;
    const service = new PaymentsService(prisma as any, {} as any, notifications);

    await service.createPaymentIntent({
      orgId: 'org',
      intentType: 'SUBSCRIPTION',
      amount: 1000,
      currency: 'USD',
    });

    prisma.paymentIntent.findFirst.mockResolvedValue({ id: 'intent', provider_ref: 'pi_123' });
    prisma.paymentIntent.update.mockResolvedValue({ id: 'intent', status: 'SUCCEEDED' });

    await service.finalizeFromWebhook('STRIPE', {
      data: { object: { id: 'pi_123', status: 'succeeded' } },
    });

    expect(prisma.paymentReceipt.create).toHaveBeenCalled();
  });
});
