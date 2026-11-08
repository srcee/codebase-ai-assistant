import { HttpClient } from '../http/http-client';

export interface ChargeRequest {
  orderId: string;
  amountCents: number;
  currency: string;
  cardReference: string;
}

export interface ChargeResult {
  chargeId: string;
  status: 'captured' | 'declined';
}

export class PaymentGateway {
  constructor(private readonly http: HttpClient) {}

  /** Charges a stored card through the external payment provider. */
  async chargeCard(request: ChargeRequest): Promise<ChargeResult> {
    const response = await this.http.post<ChargeResult>('/v2/charges', {
      order: request.orderId,
      amount: request.amountCents,
      currency: request.currency,
      card: request.cardReference,
    });
    if (response.status === 'declined') {
      throw new Error('Payment declined by issuer');
    }
    return response;
  }

  async voidCharge(chargeId: string): Promise<void> {
    await this.http.post(`/v2/charges/${chargeId}/void`, {});
  }
}
