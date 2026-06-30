import { initializeDb, getDb } from './src/db/database.js';
initializeDb();
getDb().query("ALTER TABLE matches ADD COLUMN IF NOT EXISTS duration_seconds INT DEFAULT 2400;")
  .then(() => { console.log('Done'); process.exit(0); })
  .catch(console.error);
