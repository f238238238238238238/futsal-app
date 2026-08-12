import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:Gup4nchi!!!@db.kfqppyxtbownditneaen.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const userId = 23;

    // Check basic user
    const u = await pool.query(`SELECT * FROM users WHERE user_id = $1`, [userId]);
    console.log("User:", u.rows.length);

    // Check yearlyMatchStats
    await pool.query(`
      SELECT 
        EXTRACT(YEAR FROM m.date::date) as year,
        COUNT(DISTINCT ms.match_id) as matches_played
      FROM match_stats ms
      JOIN matches m ON ms.match_id = m.match_id
      WHERE ms.user_id = $1
      GROUP BY EXTRACT(YEAR FROM m.date::date)
    `, [userId]);
    console.log("yearlyMatchStats OK");

    await pool.query(`
      SELECT 
        EXTRACT(YEAR FROM m.date::date) as year,
        event_type,
        COUNT(event_id) as event_count
      FROM match_events me
      JOIN matches m ON me.match_id = m.match_id
      WHERE me.user_id = $1
      GROUP BY EXTRACT(YEAR FROM m.date::date), event_type
    `, [userId]);
    console.log("yearlyEvents OK");
    
    // Check user_matches for possession
    const userMatchesResult = await pool.query(`
      SELECT m.match_id, EXTRACT(YEAR FROM m.date::date) as year
      FROM match_stats ms
      JOIN matches m ON ms.match_id = m.match_id
      WHERE ms.user_id = $1
    `, [userId]);
    console.log("userMatchesResult OK", userMatchesResult.rows.length);

    for (const matchRow of userMatchesResult.rows) {
      const matchId = matchRow.match_id;
      const eventsRes = await pool.query(`
        SELECT event_type, user_id, target_user_id, minute
        FROM match_events
        WHERE match_id = $1
        ORDER BY minute ASC
      `, [matchId]);
    }
    console.log("possession events OK");
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}
run();
