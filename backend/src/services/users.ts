/**
 * Everything that reads or writes the users table.
 * Routes call these functions; they never write SQL themselves.
 */
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, queryOne } from '../db/pool.js';

const BCRYPT_ROUNDS = 12;

export interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/** What the API is allowed to send back about a user — never the hash. */
export interface PublicUser {
  id: number;
  username: string;
  role: string;
}

export function toPublicUser(user: UserRow): PublicUser {
  return { id: user.id, username: user.username, role: user.role };
}

export function findByUsername(username: string): Promise<UserRow | null> {
  return queryOne<UserRow>(
    'SELECT id, username, password_hash, role, is_active, created_at, updated_at FROM users WHERE username = ? LIMIT 1',
    [username],
  );
}

export function findById(id: number): Promise<UserRow | null> {
  return queryOne<UserRow>(
    'SELECT id, username, password_hash, role, is_active, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
    [id],
  );
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createUser(username: string, plainPassword: string, role = 'user'): Promise<number> {
  const result = await execute('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [
    username,
    await hashPassword(plainPassword),
    role,
  ]);
  return result.insertId;
}

/**
 * Checks a username/password pair.
 * Returns null for every failure — unknown user, wrong password, or a
 * deactivated account — so the response cannot be used to discover which
 * usernames exist.
 */
export async function authenticate(username: string, password: string): Promise<PublicUser | null> {
  const user = await findByUsername(username);

  if (!user) {
    // Hash anyway so a missing user takes about as long as a wrong password,
    // which stops the response time from revealing that the user is unknown.
    await bcrypt.compare(password, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
    return null;
  }

  if (!user.is_active) return null;
  if (!(await verifyPassword(password, user.password_hash))) return null;

  return toPublicUser(user);
}
