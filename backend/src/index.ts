/** Server entry point: verify the database, start listening, shut down cleanly. */
import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool, verifyConnection } from './db/pool.js';

// Fail at startup rather than on the first request, so a bad password or a
// stopped MySQL is obvious immediately.
try {
  await verifyConnection();
  console.log(`Connected to MySQL database "${env.db.database}" at ${env.db.host}:${env.db.port}`);
} catch (error) {
  console.error(`Could not connect to MySQL database "${env.db.database}".`);
  console.error(error instanceof Error ? error.message : error);
  console.error('Check DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD in backend/.env');
  process.exit(1);
}

const server = createApp().listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} received, shutting down.`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  });
}
