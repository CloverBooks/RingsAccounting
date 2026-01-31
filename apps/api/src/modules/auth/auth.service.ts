import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async hashPassword(password: string) {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }

  async signToken(payload: { sub: string; orgId: string; role: string }) {
    return this.jwtService.signAsync(payload);
  }
}
