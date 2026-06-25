import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool;

export function initializeDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in the environment variables.');
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      pool.query(schema).then(() => {
        console.log('Database schema initialized successfully.');
      }).catch(err => {
        console.error('Error initializing database schema:', err);
      });
    }
  } catch (err) {
    console.error('Could not read or execute schema.sql:', err);
  }
}

export function getDb() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDb first.');
  }
  return pool;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
  }
}
