import { initializeDb, getDb } from './src/db/database.js';

async function migrate() {
  await initializeDb();
  const db = getDb();
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_salaries (
        salary_id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        salary INTEGER DEFAULT 0,
        UNIQUE(user_id, year)
      );
    `);
    
    // Migrate existing salary data to the current year as a baseline
    const currentYear = new Date().getFullYear();
    await db.query(`
      INSERT INTO user_salaries (user_id, year, salary)
      SELECT user_id, $1, salary FROM users
      ON CONFLICT (user_id, year) DO NOTHING;
    `, [currentYear]);

    console.log('Migrated user_salaries table successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  }
}

migrate();
