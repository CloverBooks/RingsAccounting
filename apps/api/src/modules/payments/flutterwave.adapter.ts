import axios from 'axios';
import crypto from 'crypto';

export class FlutterwaveAdapter {
  private readonly baseUrl = 'https://api.flutterwave.com/v3';
  private readonly secretKey = process.env.FLW_SECRET_KEY ?? '';
  private readonly secretHash = process.env.FLW_SECRET_HASH ?? '';

  async createMomoCharge(payload: Record<string, unknown>) {
    const response = await axios.post(`${this.baseUrl}/charges?type=mobile_money_rwanda`, payload, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });
    return response.data;
  }

  async verifyTransaction(transactionId: string) {
    const response = await axios.get(`${this.baseUrl}/transactions/${transactionId}/verify`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });
    return response.data;
  }

  async billsValidate(itemCode: string, customer: string) {
    const response = await axios.get(
      `${this.baseUrl}/bill-items/${itemCode}/validate?customer=${encodeURIComponent(customer)}`,
      {
        headers: { Authorization: `Bearer ${this.secretKey}` },
      },
    );
    return response.data;
  }

  async billsPay(payload: Record<string, unknown>) {
    const response = await axios.post(`${this.baseUrl}/bills`, payload, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });
    return response.data;
  }

  verifyWebhook(rawBody: Buffer, headers: Record<string, string | undefined>) {
    const verifHash = headers['verif-hash'];
    const signature = headers['flutterwave-signature'];

    if (verifHash) {
      const validHash = this.timingSafeEqual(verifHash, this.secretHash);
      if (validHash) {
        return { valid: true, method: 'verif-hash' };
      }
    }

    if (signature) {
      const digest = crypto
        .createHmac('sha256', this.secretHash)
        .update(rawBody)
        .digest('base64');
      const validSig = this.timingSafeEqual(signature, digest);
      if (validSig) {
        return { valid: true, method: 'flutterwave-signature' };
      }
    }

    return { valid: false };
  }

  async createMerchantStub() {
    return `flw_${crypto.randomUUID()}`;
  }

  async createSubaccountStub() {
    return { subaccount_id: `flw_sub_${crypto.randomUUID()}` };
  }

  private timingSafeEqual(a: string, b: string) {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(aBuf, bBuf);
  }
}
