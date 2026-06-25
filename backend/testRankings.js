import { getDb, initializeDb } from './src/db/database.js';

async function run() {
  initializeDb();
  const db = getDb();
  
  try {
    const totalEventsRes = await db.query(`SELECT COUNT(*) as count FROM events WHERE date_time < CURRENT_TIMESTAMP::text`);
    const totalMatchesRes = await db.query(`SELECT COUNT(*) as count FROM matches`);
    const totalEvents = parseInt(totalEventsRes.rows[0].count, 10) + parseInt(totalMatchesRes.rows[0].count, 10);

    const result = await db.query(`
      SELECT u.user_id, u.name, u.photo_url,
        (
          (SELECT COUNT(*) FROM attendances a JOIN events e ON a.event_id = e.event_id WHERE a.user_id = u.user_id AND a.status = 'present' AND e.date_time < CURRENT_TIMESTAMP::text) +
          (SELECT COUNT(*) FROM match_stats ms WHERE ms.user_id = u.user_id)
        ) as present_count
      FROM users u
      WHERE (
        (SELECT COUNT(*) FROM attendances a JOIN events e ON a.event_id = e.event_id WHERE a.user_id = u.user_id AND a.status = 'present' AND e.date_time < CURRENT_TIMESTAMP::text) +
        (SELECT COUNT(*) FROM match_stats ms WHERE ms.user_id = u.user_id)
      ) > 0
      ORDER BY present_count DESC, u.name ASC
      LIMIT 10
    `);

    const ranking = result.rows.map(r => ({
      ...r,
      total_events: totalEvents,
      rate: totalEvents > 0 ? Math.round((parseInt(r.present_count,10) / totalEvents) * 100) : 0
    }));

    console.log(ranking);
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
