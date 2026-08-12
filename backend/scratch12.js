import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:Gup4nchi!!!@db.kfqppyxtbownditneaen.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const date = '2026-08-09';
  const opponent_name = 'Test Team';
  const competition_name = '';
  const our_score = '5';
  const opponent_score = '2';
  const summary_text = '';
  const mom_user_id = '';
  const matchDur = 2400;
  const video_url = '';

  try {
    const matchRes = await pool.query(`
      INSERT INTO matches (date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id, duration_seconds, video_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING match_id
    `, [date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id || null, matchDur, video_url || null]);
    console.log('Match ID:', matchRes.rows[0].match_id);
    
    // delete it to keep db clean
    await pool.query('DELETE FROM matches WHERE match_id = $1', [matchRes.rows[0].match_id]);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}
run();
