/**
 * Applies every .sql file in sql/ in filename order, once each.
 *
 * Applied filenames are recorded in the schema_migrations table, so re-running
 * this is safe — already-applied files are skipped. To add a migration, drop a
 * new file in sql/ with the next number prefix; never edit an applied one.
 *
 *     npm run db:migrate
 */
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { closePool, pool, query } from './pool.js';
import type { RowDataPacket } from 'mysql2/promise';

const SQL_DIR = resolve(process.cwd(), 'sql');

interface AppliedRow extends RowDataPacket {
  filename: string;
}

/** Drops whole-line -- and # comments, so a comment-only fragment is detectable. */
function stripComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !/^\s*(--|#)/.test(line))
    .join('\n')
    .trim();
}

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (filename)
    ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  `);
}

async function migrate(): Promise<void> {
  await ensureMigrationsTable();

  const applied = new Set(
    (await query<AppliedRow>('SELECT filename FROM schema_migrations')).map((row) => row.filename),
  );

  const files = (await readdir(SQL_DIR)).filter((name) => name.endsWith('.sql')).sort();
  const pending = files.filter((name) => !applied.has(name));

  if (pending.length === 0) {
    console.log(`Database is up to date — ${files.length} migration(s) already applied.`);
    return;
  }

  for (const filename of pending) {
    const sql = await readFile(resolve(SQL_DIR, filename), 'utf8');

    // multipleStatements is off on the pool, so split the file and run each
    // statement on its own. Comment-only lines are stripped first, then any
    // fragment with nothing left in it is skipped — note the test is on the
    // stripped copy while the original statement is what actually runs.
    const statements = sql
      .split(/;\s*$/m)
      .map((statement) => statement.trim())
      .filter((statement) => stripComments(statement).length > 0);

    for (const statement of statements) {
      await pool.query(statement);
    }

    await pool.query('INSERT INTO schema_migrations (filename) VALUES (?)', [filename]);
    console.log(`  applied ${filename}`);
  }

  console.log(`Applied ${pending.length} migration(s).`);
}

try {
  await migrate();
} catch (error) {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closePool();
}
