import { getDb, initializeDb } from './database.js';
import bcrypt from 'bcryptjs';

async function run() {
  initializeDb();
  
  // Wait a little bit for db to initialize if not awaited. But initializeDb creates pool synchronously.
  const db = getDb();

  const email = 'fumintus';
  const password = '19970516';
  const name = 'フミントス管理者';
  const role = 'admin';

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  try {
    const existing = await db.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log('Admin account already exists. Updating password...');
      await db.query('UPDATE users SET password_hash = $1, role = $2 WHERE email = $3', [hash, role, email]);
      console.log('Updated successfully.');
    } else {
      console.log('Inserting new admin account...');
      await db.query(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
      `, [name, email, hash, role]);
      console.log('Inserted successfully.');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

run();
