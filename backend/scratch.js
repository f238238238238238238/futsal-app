import { initializeDb, getDb } from './src/db/database.js';
initializeDb();
const db = getDb();
db.query("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'match_events_event_type_check'")
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(()=>process.exit(0));
