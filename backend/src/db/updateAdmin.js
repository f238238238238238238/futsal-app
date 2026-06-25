import { getDb, initializeDb } from './database.js';
import bcrypt from 'bcryptjs';

async function updateAdmin() {
  initializeDb();
  const db = getDb();
  try {
    const passwordHash = bcrypt.hashSync('19970516', 10);
    const result = await db.query(
      "UPDATE users SET email = $1, password_hash = $2 WHERE role = 'admin'",
      ['fumintus', passwordHash]
    );
    console.log(`Updated ${result.rowCount} admin user(s).`);
  } catch (err) {
    console.error('Error updating admin:', err);
  } finally {
    process.exit(0);
  }
}

updateAdmin();
