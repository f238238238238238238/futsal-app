import { initializeDb, getDb, closeDb } from './src/db/database.js';

async function main() {
  initializeDb();
  
  // Wait a bit for pool to connect
  await new Promise(resolve => setTimeout(resolve, 500));
  const db = getDb();

  try {
    console.log('Altering match_stats table...');
    await db.query('ALTER TABLE match_stats ADD COLUMN saves INTEGER DEFAULT 0;');
  } catch (err) {
    console.log('Column saves might already exist:', err.message);
  }

  try {
    console.log('Altering match_events table to add position...');
    await db.query('ALTER TABLE match_events ADD COLUMN position TEXT;');
  } catch (err) {
    console.log('Column position might already exist:', err.message);
  }

  try {
    console.log('Updating event_type constraint on match_events...');
    await db.query('ALTER TABLE match_events DROP CONSTRAINT match_events_event_type_check;');
  } catch (err) {
    console.log('Constraint might not exist:', err.message);
  }

  try {
    await db.query(`ALTER TABLE match_events ADD CONSTRAINT match_events_event_type_check CHECK (event_type IN ('goal','assist','sub_in','sub_out','position_change'));`);
    console.log('Constraint updated successfully.');
  } catch (err) {
    console.error('Failed to add constraint:', err.message);
  }

  console.log('Done altering DB.');
  await closeDb();
}

main();
