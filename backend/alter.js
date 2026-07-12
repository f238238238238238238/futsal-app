import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:Gup4nchi!!!@db.kfqppyxtbownditneaen.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
pool.query('ALTER TABLE match_events ALTER COLUMN user_id DROP NOT NULL')
  .then(() => {
    console.log('ALTERED');
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
