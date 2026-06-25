import { getDb, initializeDb } from './database.js';

async function test() {
  initializeDb();
  const db = getDb();
  try {
    const r = await db.query('SELECT * FROM match_stats');
    console.log('Match Stats:', r.rows);
    const m = await db.query('SELECT * FROM matches');
    console.log('Matches:', m.rows);
    
    // Check rankings
    const rankings = await db.query(`
      SELECT u.user_id, u.name, u.photo_url, SUM(ms.goals) as total_goals
      FROM users u
      JOIN match_stats ms ON u.user_id = ms.user_id
      GROUP BY u.user_id
      HAVING SUM(ms.goals) > 0
    `);
    console.log('Rankings:', rankings.rows);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
