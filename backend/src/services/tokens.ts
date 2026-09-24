/** Signing and checking the login tokens. */
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { PublicUser } from './users.js';

export interface TokenPayload {
  sub: number;
  username: string;
  role: string;
}

export function signToken(user: PublicUser): string {
  const payload: TokenPayload = { sub: user.id, username: user.username, role: user.role };
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn } as SignOptions);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.jwt.secret) as unknown as TokenPayload;
  } catch {
    return null;
  }
}
