/**
 * Shared HTTP error handling.
 *
 * Routes throw ApiError for anything the caller should see; everything else
 * becomes a generic 500, because an unexpected error's message may contain
 * connection strings or SQL and has no business reaching the client.
 */
import type { NextFunction, Request, Response } from 'express';
import { isProduction } from '../config/env.js';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal server error',
    ...(isProduction ? {} : { detail: err instanceof Error ? err.message : String(err) }),
  });
}
