import jwt from 'jsonwebtoken';
import crypto from 'crypto';

interface TokenPayload {
  sub: string;
  roles: string[];
  jti: string;
  type: 'access' | 'refresh';
}

export class JWTService {
  private accessSecret: Buffer;
  private refreshSecret: Buffer;

  constructor() {
    this.accessSecret = Buffer.from(process.env.JWT_ACCESS_SECRET!, 'base64');
    this.refreshSecret = Buffer.from(process.env.JWT_REFRESH_SECRET!, 'base64');
  }

  generateAccessToken(userId: string, roles: string[]): string {
    return jwt.sign(
      { sub: userId, roles, jti: crypto.randomUUID(), type: 'access' },
      this.accessSecret,
      { expiresIn: '15m', algorithm: 'HS256' }
    );
  }

  generateRefreshToken(userId: string): { token: string; jti: string } {
    const jti = crypto.randomUUID();
    const token = jwt.sign(
      { sub: userId, jti, type: 'refresh' },
      this.refreshSecret,
      { expiresIn: '7d', algorithm: 'HS256' }
    );
    return { token, jti };
  }

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, this.accessSecret, { algorithms: ['HS256'] }) as TokenPayload;
  }

  verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(token, this.refreshSecret, { algorithms: ['HS256'] }) as TokenPayload;
  }

  decode(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch {
      return null;
    }
  }
}
