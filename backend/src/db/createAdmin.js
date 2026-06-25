import { getDb, initializeDb } from './database.js';
import bcrypt from 'bcryptjs';

async function createAdmin() {
  initializeDb();
  const db = getDb();
  try {
    const passwordHash = bcrypt.hashSync('19970516', 10);
    
    // Check if admin exists
    const check = await db.query("SELECT * FROM users WHERE role = 'admin'");
    if (check.rows.length === 0) {
      await db.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')",
        ['管理者', 'fumintus', passwordHash]
      );
      console.log('Created admin user successfully.');
    } else {
      await db.query(
        "UPDATE users SET email = $1, password_hash = $2 WHERE role = 'admin'",
        ['fumintus', passwordHash]
      );
      console.log('Updated existing admin user successfully.');
    }
  } catch (err) {
    console.error('Error creating/updating admin:', err);
  } finally {
    process.exit(0);
  }
}

createAdmin();
