/**
 * Verifies the Bearer token on routes that require a signed-in user.
 * Not used by the login route itself — that is how you get a token.
 */
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './error.js';
import { verifyToken, type TokenPayload } from '../services/tokens.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.get('authorization');

  if (!header?.startsWith('Bearer ')) {
    next(new ApiError(401, 'Authentication required'));
    return;
  }

  const payload = verifyToken(header.slice('Bearer '.length).trim());
  if (!payload) {
    next(new ApiError(401, 'Invalid or expired token'));
    return;
  }

  req.user = payload;
  next();
}
