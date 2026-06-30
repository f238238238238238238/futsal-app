import { initializeDb, getDb } from './src/db/database.js';

async function migrate() {
  await initializeDb();
  const db = getDb();
  try {
    await db.query('ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS position TEXT');
    console.log('Added position column to match_stats table');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  }
}

migrate();
