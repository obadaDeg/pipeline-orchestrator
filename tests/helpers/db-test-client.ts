import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../../src/db/schema.js';

const connectionString = process.env.DATABASE_URL!;

export const testPool = new pg.Pool({ connectionString });
export const testDb = drizzle(testPool, { schema });

export async function runTestMigrations(): Promise<void> {
  await migrate(testDb, { migrationsFolder: 'drizzle' });
}

export async function truncateAllTables(): Promise<void> {
  await testPool.query(
    'TRUNCATE TABLE delivery_attempts, jobs, subscribers, pipelines RESTART IDENTITY CASCADE',
  );
}
