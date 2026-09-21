/**
 * Creates a starter admin account so there is something to log in with.
 * Safe to re-run: an existing username is left untouched.
 *
 *     npm run db:seed                       -> admin / admin123
 *     npm run db:seed -- myuser mypassword  -> your own
 */
import { closePool } from './pool.js';
import { createUser, findByUsername } from '../services/users.js';

const username = process.argv[2] ?? 'admin';
const password = process.argv[3] ?? 'admin123';

try {
  if (await findByUsername(username)) {
    console.log(`User "${username}" already exists — nothing to do.`);
  } else {
    await createUser(username, password, 'admin');
    console.log(`Created user "${username}" with password "${password}".`);
    console.log('Change this password before the site goes anywhere near production.');
  }
} catch (error) {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closePool();
}
