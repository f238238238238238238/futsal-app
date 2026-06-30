import { initializeDb, getDb } from './src/db/database.js';
initializeDb();
getDb().query("ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_event_type_check; ALTER TABLE match_events ADD CONSTRAINT match_events_event_type_check CHECK (event_type IN ('goal', 'assist', 'yellow_card', 'red_card', 'sub_in', 'sub_out', 'position_change', 'save'));")
  .then(() => { console.log('Done'); process.exit(0); })
  .catch(console.error);
