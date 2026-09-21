/**
 * The one and only database connection for the whole app.
 *
 * Import this file from anywhere that needs the database:
 *
 *     import { query, queryOne, pool } from '../db/pool.js';
 *
 * The pool below is created exactly once. An ES module runs a single time per
 * process no matter how many files import it, so every importer shares this
 * same instance — there is never a second connection set up somewhere else.
 *
 * It is a *pool* rather than one raw connection on purpose: a single connection
 * can only run one query at a time and dies for good if the network blips,
 * whereas the pool keeps a small set of reusable connections, hands one to each
 * query, takes it back afterwards, and reconnects on its own. Callers do not
 * open or close anything.
 */
import mysql, { type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';
import { env } from '../config/env.js';

export const pool: Pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.database,
  user: env.db.user,
  password: env.db.password,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,

  // Return DATE/DATETIME as strings rather than JS Dates, so values survive
  // the trip to JSON without the server's timezone rewriting them.
  dateStrings: true,
});

/** The value types MySQL accepts as a bound `?` parameter. */
export type SqlParam = string | number | boolean | null | Date | Buffer;

/** Runs a SELECT and returns all matching rows. */
export async function query<T extends RowDataPacket>(sql: string, params: SqlParam[] = []): Promise<T[]> {
  const [rows] = await pool.execute<T[]>(sql, params);
  return rows;
}

/** Runs a SELECT and returns the first row, or null when nothing matched. */
export async function queryOne<T extends RowDataPacket>(sql: string, params: SqlParam[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Runs an INSERT/UPDATE/DELETE and returns affectedRows, insertId and friends. */
export async function execute(sql: string, params: SqlParam[] = []): Promise<ResultSetHeader> {
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result;
}

/**
 * Runs several statements as one transaction on a single connection.
 * Commits when the callback returns, rolls back if it throws, and always
 * gives the connection back to the pool.
 */
export async function transaction<T>(fn: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** Verifies the database is actually reachable. Called once at startup. */
export async function verifyConnection(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

/** Closes every pooled connection so the process can exit cleanly. */
export async function closePool(): Promise<void> {
  await pool.end();
}
