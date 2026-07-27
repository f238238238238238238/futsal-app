import { initializeDb, getDb, closeDb } from './src/db/database.js';

async function main() {
  try {
    initializeDb();
    // Wait a bit for initialization
    await new Promise(r => setTimeout(r, 1000));
    const pool = getDb();
    await pool.query('ALTER TABLE matches ADD COLUMN video_url TEXT;');
    console.log('Column added successfully');
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      console.log('Column already exists');
    } else {
      console.error(err);
    }
  } finally {
    await closeDb();
  }
}

main();
