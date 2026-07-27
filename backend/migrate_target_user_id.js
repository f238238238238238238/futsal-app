import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE match_events ADD COLUMN IF NOT EXISTS target_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;`);
    console.log('Successfully added target_user_id to match_events');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
