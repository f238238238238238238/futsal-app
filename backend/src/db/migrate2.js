import { getDb, initializeDb } from './database.js';

async function run() {
  initializeDb();
  const db = getDb();

  try {
    console.log('Running migration 2: updating foreign keys to CASCADE...');

    // match_stats
    await db.query(`ALTER TABLE match_stats DROP CONSTRAINT IF EXISTS match_stats_user_id_fkey;`);
    await db.query(`ALTER TABLE match_stats ADD CONSTRAINT match_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;`);
    await db.query(`ALTER TABLE match_stats DROP CONSTRAINT IF EXISTS match_stats_match_id_fkey;`);
    await db.query(`ALTER TABLE match_stats ADD CONSTRAINT match_stats_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE;`);

    // match_events
    await db.query(`ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_user_id_fkey;`);
    await db.query(`ALTER TABLE match_events ADD CONSTRAINT match_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;`);
    await db.query(`ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_match_id_fkey;`);
    await db.query(`ALTER TABLE match_events ADD CONSTRAINT match_events_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE;`);

    // attendances
    await db.query(`ALTER TABLE attendances DROP CONSTRAINT IF EXISTS attendances_user_id_fkey;`);
    await db.query(`ALTER TABLE attendances ADD CONSTRAINT attendances_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;`);
    
    // fumindor
    await db.query(`ALTER TABLE fumindor DROP CONSTRAINT IF EXISTS fumindor_user_id_fkey;`);
    await db.query(`ALTER TABLE fumindor ADD CONSTRAINT fumindor_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;`);

    console.log('Migrations completed successfully.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    process.exit(0);
  }
}

run();
