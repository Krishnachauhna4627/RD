/**
 * Reads .env once, validates it, and exports the result.
 *
 * Node 22+ can load a .env file itself, so there is no dotenv dependency.
 * Doing it here rather than via the `--env-file` CLI flag means every entry
 * point (server, migrate, seed) gets the same config without remembering a flag.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = resolve(process.cwd(), '.env');

// In production the values usually come from the real environment, so a
// missing file is not an error — a missing *value* is, and that is caught below.
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

function required(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable ${key}. ` +
        `Set it in backend/.env — see .env.example for the full list.`,
    );
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

function port(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${key} must be a port number between 1 and 65535, got "${raw}".`);
  }
  return parsed;
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: port('PORT', 3000),
  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:4200'),

  db: {
    host: optional('DB_HOST', 'localhost'),
    port: port('DB_PORT', 3306),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
  },

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: optional('JWT_EXPIRES_IN', '24h'),
  },
} as const;

export const isProduction = env.nodeEnv === 'production';
