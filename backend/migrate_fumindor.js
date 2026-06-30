import { initializeDb, getDb } from './src/db/database.js';

async function migrate() {
  await initializeDb();
  const db = getDb();

  try {
    // Add columns to fumindor table
    await db.query(`ALTER TABLE fumindor ADD COLUMN saves INTEGER DEFAULT 0`);
    console.log('Added saves column');
  } catch (e) { console.log(e.message); }
  
  try {
    await db.query(`ALTER TABLE fumindor ADD COLUMN minutes_played INTEGER DEFAULT 0`);
    console.log('Added minutes_played column');
  } catch (e) { console.log(e.message); }

  try {
    await db.query(`ALTER TABLE fumindor ADD COLUMN attendance_rate REAL DEFAULT 0`);
    console.log('Added attendance_rate column');
  } catch (e) { console.log(e.message); }

  console.log('Migration complete');
  process.exit(0);
}

migrate();
