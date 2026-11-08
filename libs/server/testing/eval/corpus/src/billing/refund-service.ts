import { PaymentGateway } from './payment-gateway';

const REFUND_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PaidOrder {
  id: string;
  chargeId: string;
  paidAt: number;
  totalCents: number;
}

export class RefundService {
  constructor(private readonly gateway: PaymentGateway) {}

  /** Cancels the charge of an order, but only inside the refund window. */
  async refundOrder(order: PaidOrder, now = Date.now()): Promise<void> {
    const ageDays = (now - order.paidAt) / DAY_MS;
    if (ageDays > REFUND_WINDOW_DAYS) {
      throw new Error('Refund window of 30 days has passed');
    }
    await this.gateway.voidCharge(order.chargeId);
  }
}
