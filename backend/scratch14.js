import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:Gup4nchi!!!@db.kfqppyxtbownditneaen.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'matches';
    `);
    console.table(res.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}
run();
