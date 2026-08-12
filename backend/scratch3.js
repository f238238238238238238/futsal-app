import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:Gup4nchi!!!@db.kfqppyxtbownditneaen.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  try {
    const res = await pool.query("SELECT $1::text", [undefined]);
    console.log('Success:', res.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}
run();
