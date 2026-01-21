import { BadRequestException, Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { timingSafeEqualStrings } from '../common/utils/timing-safe-equal';

@Injectable()
export class FlutterwaveWebhookService {
  verify(rawBody: Buffer, headers: Record<string, string | undefined>): boolean {
    const secret = process.env.FLW_SECRET_HASH;
    if (!secret) {
      throw new BadRequestException('Flutterwave secret hash not configured');
    }

    const headerMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value) {
        headerMap[key.toLowerCase()] = value;
      }
    }

    const verifHash = headerMap['verif-hash'];
    if (verifHash) {
      return timingSafeEqualStrings(verifHash, secret);
    }

    const signature = headerMap['flutterwave-signature'];
    if (signature) {
      const computed = createHmac('sha256', secret).update(rawBody).digest('base64');
      return timingSafeEqualStrings(signature, computed);
    }

    return false;
  }
}
