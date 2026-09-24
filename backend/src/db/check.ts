/**
 * Prints whether the database is reachable and what is in it.
 * First thing to run when something is not working: npm run db:check
 */
import { env } from '../config/env.js';
import { closePool, query, verifyConnection } from './pool.js';
import type { RowDataPacket } from 'mysql2/promise';

interface TableRow extends RowDataPacket {
  table_name: string;
  table_rows: number | null;
}

try {
  await verifyConnection();
  console.log(`OK  connected to "${env.db.database}" as ${env.db.user}@${env.db.host}:${env.db.port}`);

  const tables = await query<TableRow>(
    `SELECT TABLE_NAME AS table_name, TABLE_ROWS AS table_rows
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME`,
    [env.db.database],
  );

  if (tables.length === 0) {
    console.log('    no tables yet — run: npm run db:migrate');
  } else {
    console.log(`    ${tables.length} table(s):`);
    for (const table of tables) {
      console.log(`      ${table.table_name} (~${table.table_rows ?? 0} rows)`);
    }
  }
} catch (error) {
  console.error(`FAIL  could not reach "${env.db.database}" at ${env.db.host}:${env.db.port}`);
  console.error(`      ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await closePool();
}
