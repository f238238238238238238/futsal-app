import { initializeDb, getDb } from './src/db/database.js';

async function migrate() {
  await initializeDb();
  const db = getDb();
  try {
    await db.query('ALTER TABLE events ADD COLUMN IF NOT EXISTS is_held BOOLEAN DEFAULT false');
    console.log('Added is_held column to events table');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  }
}

migrate();
