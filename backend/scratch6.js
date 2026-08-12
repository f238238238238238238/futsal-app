import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:Gup4nchi!!!@db.kfqppyxtbownditneaen.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  try {
    const res = await pool.query("INSERT INTO match_events (match_id, event_type, user_id, minute) VALUES (1, 'recovery', $1, 10) RETURNING *", [undefined]);
    console.log('Success:', res.rows);
    await pool.query("DELETE FROM match_events WHERE event_id = $1", [res.rows[0].event_id]);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    pool.end();
  }
}
run();
