import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;

// Mock Redis for demonstration
const redisStore = new Map<string, { userId: string; expiresAt: number }>();

export class TokenService {
  generateAccessToken(userId: string, roles: string[]): string {
    return jwt.sign({ sub: userId, roles }, ACCESS_SECRET, { expiresIn: '15m' });
  }

  generateRefreshToken(userId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const ttlMs = 7 * 24 * 60 * 60 * 1000;
    redisStore.set(token, { userId, expiresAt: Date.now() + ttlMs });
    return token;
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const record = redisStore.get(refreshToken);
    if (!record || record.expiresAt < Date.now()) {
      throw new Error('Invalid refresh token');
    }
    const roles = await getRoles(record.userId);
    return this.generateAccessToken(record.userId, roles);
  }

  async revokeRefreshToken(refreshToken: string) {
    redisStore.delete(refreshToken);
  }
}

async function getRoles(userId: string): Promise<string[]> {
  return ['user'];
}
