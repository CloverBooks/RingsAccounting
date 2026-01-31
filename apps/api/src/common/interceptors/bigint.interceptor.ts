import { CallHandler, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(_context: unknown, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => this.serializeBigInt(data)));
  }

  private serializeBigInt(value: unknown): unknown {
    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.serializeBigInt(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, val]) => [
          key,
          this.serializeBigInt(val),
        ]),
      );
    }

    return value;
  }
}
