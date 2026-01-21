import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  getStatus(): { status: string } {
    return { status: 'ok' };
  }
}
