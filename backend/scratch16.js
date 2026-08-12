import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:Gup4nchi!!!@db.kfqppyxtbownditneaen.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const summary_text = undefined;
    const matchRes = await pool.query(`
      INSERT INTO matches (date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id, duration_seconds, video_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING match_id
    `, ['2026-08-09', 'Test', '', 5, 2, summary_text, null, 2400, null]);
    console.log('Match ID:', matchRes.rows[0].match_id);
    await pool.query('DELETE FROM matches WHERE match_id = $1', [matchRes.rows[0].match_id]);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}
run();
