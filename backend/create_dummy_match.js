import { initializeDb, getDb } from './src/db/database.js';

async function main() {
  await initializeDb();
  const db = getDb();
  await db.query('BEGIN');
  const matchRes = await db.query(`INSERT INTO matches (date, opponent_name, competition_name, our_score, opponent_score, summary_text, duration_seconds) VALUES (NOW(), 'Dummy Team', 'Test Cup', 2, 1, 'Test Match', 1200) RETURNING match_id`);
  const matchId = matchRes.rows[0].match_id;
  
  const users = await db.query('SELECT user_id, position FROM users LIMIT 5');
  const extPos = ['GK', 'Fixo', 'Ala L', 'Ala R', 'Pivo'];
  for (let i = 0; i < users.rows.length; i++) {
    const u = users.rows[i];
    const pos = extPos[i];
    await db.query(`INSERT INTO match_stats (match_id, user_id, is_starter, goals, assists, minutes_played, saves, position) VALUES ($1, $2, 1, 0, 0, 1200, 0, $3)`, [matchId, u.user_id, pos]);
  }
  
  await db.query('COMMIT');
  console.log('Created dummy match with ID:', matchId);
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
