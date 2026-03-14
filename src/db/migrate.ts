import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index.js';
import { logger } from '../lib/logger.js';

export async function runMigrations(): Promise<void> {
  logger.info('Running database migrations...');
  await migrate(db, { migrationsFolder: 'drizzle' });
  logger.info('Migrations complete.');
}

// Entry point when run directly (npm run db:migrate / Docker migrator service)
runMigrations()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Migration failed', err);
    process.exit(1);
  })
  .finally(() => pool.end());
