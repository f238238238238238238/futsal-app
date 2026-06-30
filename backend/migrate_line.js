import { initializeDb, getDb } from './src/db/database.js';

async function migrate() {
  await initializeDb();
  const db = getDb();
  try {
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS line_user_id TEXT UNIQUE');
    console.log('Added line_user_id column to users table');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  }
}

migrate();
