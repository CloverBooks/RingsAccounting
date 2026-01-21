import { Injectable } from '@nestjs/common';

@Injectable()
export class TelemetryService {
  getStatus(): { enabled: boolean } {
    return { enabled: process.env.OTEL_ENABLED === 'true' };
  }
}
