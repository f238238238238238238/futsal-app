import { getDb } from './src/db/database.js';
async function run() {
  const db = getDb();
  const res = await db.query('SELECT user_id, name, role FROM users');
  console.log(res.rows);
  process.exit(0);
}
run();
