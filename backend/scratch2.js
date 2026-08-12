import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:Gup4nchi!!!@db.kfqppyxtbownditneaen.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  try {
    const res = await pool.query("INSERT INTO match_events (match_id, event_type, user_id, minute) VALUES (33, 'steal', NULL, 10)");
    console.log('Success');
    await pool.query("DELETE FROM match_events WHERE event_type = 'steal' AND match_id = 33");
  } catch (err) {
    console.error('Error:', err);
  } finally {
    pool.end();
  }
}
run();
