import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:Gup4nchi!!!@db.kfqppyxtbownditneaen.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  try {
    const res = await pool.query("SELECT is_nullable FROM information_schema.columns WHERE table_name = 'match_events' AND column_name = 'user_id'");
    console.log('user_id nullable?', res.rows[0].is_nullable);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}
run();
