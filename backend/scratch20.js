import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:Gup4nchi!!!@db.kfqppyxtbownditneaen.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const USER_FIELDS = 'user_id, name, email, role, jersey_number, position, dominant_foot, birth_date, height, weight, photo_url, catchphrase, reason_started, hobby, season_goal, favorite_shoes, salary, stat_offense, stat_defense, stat_kick, stat_speed, stat_technique, stat_stamina, line_name, created_at, updated_at';

async function run() {
  try {
    const db = pool;
    const req = { params: { id: 23 } };

    const result = await db.query(`SELECT ${USER_FIELDS} FROM users WHERE user_id = $1`, [req.params.id]);
    const user = result.rows[0];

    if (!user) {
      console.log('User not found');
      return;
    }

    // Get salaries
    const salariesResult = await db.query(`SELECT year, salary FROM user_salaries WHERE user_id = $1 ORDER BY year DESC`, [req.params.id]);
    user.salaries = salariesResult.rows;

    // Get yearly match stats
    const yearlyMatchStatsResult = await db.query(`
      SELECT 
        EXTRACT(YEAR FROM m.date::date) as year,
        COUNT(DISTINCT ms.match_id) as matches_played,
        COALESCE(SUM(ms.goals), 0) as goals,
        COALESCE(SUM(ms.assists), 0) as assists,
        COALESCE(SUM(ms.saves), 0) as saves,
        COALESCE(SUM(ms.minutes_played), 0) as minutes_played
      FROM match_stats ms
      JOIN matches m ON ms.match_id = m.match_id
      WHERE ms.user_id = $1
      GROUP BY EXTRACT(YEAR FROM m.date::date)
    `, [req.params.id]);

    const yearlyGkMatchesResult = await db.query(`
      SELECT 
        EXTRACT(YEAR FROM m.date::date) as year,
        COUNT(DISTINCT me.match_id) as gk_matches_played
      FROM match_events me
      JOIN matches m ON me.match_id = m.match_id
      WHERE me.user_id = $1 AND me.event_type IN ('save', 'catch', 'concede')
      GROUP BY EXTRACT(YEAR FROM m.date::date)
    `, [req.params.id]);

    const gkMatchesByYear = {};
    for (const row of yearlyGkMatchesResult.rows) {
      gkMatchesByYear[row.year] = parseInt(row.gk_matches_played, 10);
    }

    const yearlyEventsResult = await db.query(`
      SELECT 
        EXTRACT(YEAR FROM m.date::date) as year,
        event_type,
        COUNT(event_id) as event_count
      FROM match_events me
      JOIN matches m ON me.match_id = m.match_id
      WHERE me.user_id = $1
      GROUP BY EXTRACT(YEAR FROM m.date::date), event_type
    `, [req.params.id]);

    const eventsByYear = {};
    for (const row of yearlyEventsResult.rows) {
      if (!eventsByYear[row.year]) eventsByYear[row.year] = {};
      eventsByYear[row.year][row.event_type] = parseInt(row.event_count, 10);
    }

    const yearlyTargetEventsResult = await db.query(`
      SELECT 
        EXTRACT(YEAR FROM m.date::date) as year,
        event_type,
        COUNT(event_id) as event_count
      FROM match_events me
      JOIN matches m ON me.match_id = m.match_id
      WHERE me.target_user_id = $1
      GROUP BY EXTRACT(YEAR FROM m.date::date), event_type
    `, [req.params.id]);

    const targetEventsByYear = {};
    for (const row of yearlyTargetEventsResult.rows) {
      if (!targetEventsByYear[row.year]) targetEventsByYear[row.year] = {};
      targetEventsByYear[row.year][row.event_type] = parseInt(row.event_count, 10);
    }

    // Calculate Possession Seconds for the user
    const userMatchesResult = await db.query(`
      SELECT m.match_id, EXTRACT(YEAR FROM m.date::date) as year
      FROM match_stats ms
      JOIN matches m ON ms.match_id = m.match_id
      WHERE ms.user_id = $1
    `, [req.params.id]);

    const possessionByYear = {};
    for (const matchRow of userMatchesResult.rows) {
      const matchId = matchRow.match_id;
      const year = matchRow.year;
      if (!possessionByYear[year]) possessionByYear[year] = 0;

      const eventsRes = await db.query(`
        SELECT event_type, user_id, target_user_id, minute
        FROM match_events
        WHERE match_id = $1
        ORDER BY minute ASC
      `, [matchId]);

      let currentPossessorId = null;
      let possessionStartTime = 0;

      for (const ev of eventsRes.rows) {
        if (currentPossessorId === parseInt(req.params.id, 10) && ev.minute >= possessionStartTime) {
          possessionByYear[year] += (ev.minute - possessionStartTime);
        }
        possessionStartTime = ev.minute;

        switch (ev.event_type) {
          case 'pass':
            currentPossessorId = ev.target_user_id || 'opponent';
            break;
          case 'kickoff':
            currentPossessorId = ev.target_user_id || ev.user_id || 'opponent';
            break;
          case 'pass_cut':
          case 'steal':
          case 'recovery':
          case 'catch':
          case 'free_kick':
          case 'pk':
          case 'side_out':
          case 'goal_kick':
          case 'corner_kick':
          case 'clear':
          case 'opponent_clear':
            currentPossessorId = ev.user_id || 'opponent';
            break;
          case 'lost_ball':
          case 'pass_miss':
          case 'trap_miss':
          case 'goal':
          case 'opponent_goal':
          case 'shot':
          case 'shot_off':
          case 'concede':
          case 'opponent_shot_off':
          case 'foul':
          case 'foul_opponent':
          case 'opponent_pass_fail':
            currentPossessorId = null;
            break;
          default:
            break;
        }
      }
    }


    // Get yearly event attendances
    const yearlyAttendanceResult = await db.query(`
      SELECT 
        EXTRACT(YEAR FROM e.date_time::timestamp) as year,
        COUNT(a.event_id) as present_count
      FROM attendances a
      JOIN events e ON a.event_id = e.event_id
      WHERE a.user_id = $1 AND a.status = 'present' AND e.is_held = true
      GROUP BY EXTRACT(YEAR FROM e.date_time::timestamp)
    `, [req.params.id]);

    const totalEventsResult = await db.query(`
      SELECT 
        EXTRACT(YEAR FROM date_time::timestamp) as year,
        COUNT(event_id) as total_events
      FROM events
      WHERE date_time::timestamp < CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'
      GROUP BY EXTRACT(YEAR FROM date_time::timestamp)
    `);

    const totalMatchesResult = await db.query(`
      SELECT 
        EXTRACT(YEAR FROM date::date) as year,
        COUNT(match_id) as total_matches
      FROM matches
      GROUP BY EXTRACT(YEAR FROM date::date)
    `);

    console.log("No DB Error");
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  } finally {
    pool.end();
  }
}
run();
