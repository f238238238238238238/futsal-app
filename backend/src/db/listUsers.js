import { getDb, initializeDb } from './database.js';

async function listUsers() {
  initializeDb();
  const db = getDb();
  try {
    const result = await db.query('SELECT user_id, name, email, role FROM users');
    console.log(result.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

listUsers();
