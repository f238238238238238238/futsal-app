import { initializeDb, getDb } from './src/db/database.js';
initializeDb();
getDb().query("UPDATE match_events SET minute = minute * 60 WHERE minute <= 40;")
  .then(() => { console.log('Done'); process.exit(0); })
  .catch(console.error);
