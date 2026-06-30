const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:postgres@localhost:5432/futsal' });
client.connect().then(() => {
  return client.query(`SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'match_events'::regclass`);
}).then(res => {
  console.log(res.rows);
  const check = res.rows.find(r => r.conname === 'match_events_event_type_check');
  if (check) {
    console.log("Dropping constraint...");
    return client.query(`ALTER TABLE match_events DROP CONSTRAINT match_events_event_type_check`);
  }
}).then(() => {
  console.log("Done");
  client.end();
}).catch(err => {
  console.error(err);
  client.end();
});
