import crypto from 'crypto';

export const hashPayload = (payload: string) =>
  crypto.createHash('sha256').update(payload).digest('hex');
