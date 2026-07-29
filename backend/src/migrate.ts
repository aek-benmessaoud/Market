import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './db/index.js';
import 'dotenv/config';

async function main() {
  console.log('Running database migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});