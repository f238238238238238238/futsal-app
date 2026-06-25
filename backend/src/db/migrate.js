import { getDb, initializeDb } from './database.js';

async function run() {
  initializeDb();
  const db = getDb();

  try {
    console.log('Running migrations...');

    // 1. Add minutes_played to match_stats
    console.log('Adding minutes_played to match_stats...');
    await db.query(`
      ALTER TABLE match_stats 
      ADD COLUMN IF NOT EXISTS minutes_played INTEGER DEFAULT 0;
    `);

    // 2. Fix matches.mom_user_id foreign key constraint
    console.log('Fixing foreign key for mom_user_id...');
    await db.query(`
      ALTER TABLE matches 
      DROP CONSTRAINT IF EXISTS matches_mom_user_id_fkey;
    `);
    await db.query(`
      ALTER TABLE matches 
      ADD CONSTRAINT matches_mom_user_id_fkey 
      FOREIGN KEY (mom_user_id) 
      REFERENCES users(user_id) 
      ON DELETE SET NULL;
    `);

    console.log('Migrations completed successfully.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    process.exit(0);
  }
}

run();
