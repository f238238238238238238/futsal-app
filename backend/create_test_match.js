import { initializeDb, getDb } from './src/db/database.js';

async function main() {
  await initializeDb();
  const db = getDb();
  
  await db.query('BEGIN');
  
  // Create match
  const matchRes = await db.query(`
    INSERT INTO matches (date, opponent_name, competition_name, our_score, opponent_score, summary_text, duration_seconds) 
    VALUES (NOW(), 'FC Dummy', 'Friendly Match', 3, 1, 'Great test match with lots of stats!', 1200) 
    RETURNING match_id
  `);
  const matchId = matchRes.rows[0].match_id;
  
  // Get users
  const usersRes = await db.query('SELECT user_id, name, position FROM users LIMIT 5');
  const users = usersRes.rows;
  
  if (users.length === 0) {
    console.log('No users found.');
    return;
  }
  
  const extPos = ['GK', 'Fixo', 'Ala L', 'Ala R', 'Pivo'];
  
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const pos = extPos[i % extPos.length];
    
    // Add match_stats
    const isGK = pos === 'GK' || u.position === 'ゴレイロ' || u.position === 'GK';
    const goals = isGK ? 0 : 1;
    const assists = isGK ? 0 : 2;
    const saves = isGK ? 5 : 0;
    
    await db.query(`
      INSERT INTO match_stats (match_id, user_id, is_starter, goals, assists, minutes_played, saves, position) 
      VALUES ($1, $2, 1, $3, $4, 12, $5, $6)
    `, [matchId, u.user_id, goals, assists, saves, pos]);
    
    // Add events
    const insertEvent = async (type, count, target = null) => {
      for (let j = 0; j < count; j++) {
        await db.query(`
          INSERT INTO match_events (match_id, user_id, event_type, target_user_id, minute) 
          VALUES ($1, $2, $3, $4, 10)
        `, [matchId, u.user_id, type, target]);
      }
    };
    
    // Some passes (good and bad)
    await insertEvent('pass', 15);
    await insertEvent('pass_miss', 3);
    await insertEvent('lost_ball', 2);
    
    // Some defense
    await insertEvent('steal', 3);
    await insertEvent('pass_cut', 4);
    await insertEvent('block', 2);
    await insertEvent('defense', 3); // clear
    await insertEvent('recovery', 5);
    
    // Shots
    await insertEvent('shot', 3);
    await insertEvent('shot_off', 1);
    
    // If GK
    if (isGK) {
      await insertEvent('save', 4);
      await insertEvent('catch', 3);
      await insertEvent('concede', 1);
    }
  }
  
  // Create some target events for positioning (received passes)
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const target = users[(i + 1) % users.length];
    for (let j = 0; j < 25; j++) {
      await db.query(`
        INSERT INTO match_events (match_id, user_id, event_type, target_user_id, minute) 
        VALUES ($1, $2, 'pass', $3, 10)
      `, [matchId, u.user_id, target.user_id]);
    }
  }
  
  await db.query('COMMIT');
  console.log('Created dummy match with events! Match ID:', matchId);
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  const db = getDb();
  await db.query('ROLLBACK');
  process.exit(1);
});
