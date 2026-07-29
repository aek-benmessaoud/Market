import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './db/index.js';
import { sql } from 'drizzle-orm';
import 'dotenv/config';

async function main() {
  console.log('Checking database state...');

  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'stores'
    ) as exists
  `);

  const tablesExist = result.rows[0]?.exists === true || result.rows[0]?.exists === 't';

  if (tablesExist) {
    console.log('Tables already exist, skipping migration.');
  } else {
    console.log('Running database migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations complete.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});