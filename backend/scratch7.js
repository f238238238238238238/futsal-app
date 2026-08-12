import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:Gup4nchi!!!@db.kfqppyxtbownditneaen.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create a dummy match
    const matchRes = await client.query(`
      INSERT INTO matches (date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id, duration_seconds)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING match_id
    `, ['2023-10-10', 'Test', 'Test', 0, 0, '', null, 2400]);
    const matchId = matchRes.rows[0].match_id;

    const events = [
      { event_type: 'opponent_pass_fail', user_id: undefined },
      { event_type: 'pass_cut', user_id: '1' },
      { event_type: 'steal', user_id: '2' }
    ];

    const values = [];
    const params = [];
    events.forEach((ev, i) => {
      const offset = i * 6;
      const isDummy = typeof ev.user_id === 'string' && (ev.user_id.startsWith('dummy_') || ev.user_id === 'opponent');
      const uid = isDummy ? null : ev.user_id;
      const pos = isDummy ? ev.user_id : (ev.position || null);
      
      let targetUid = null;
      if (ev.target_user_id && ev.target_user_id !== 'opponent') {
        targetUid = ev.target_user_id;
      }

      values.push(`($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6})`);
      params.push(matchId, ev.event_type, uid, ev.minute || null, pos, targetUid);
    });
    
    console.log('Query:', `INSERT INTO match_events (match_id, event_type, user_id, minute, position, target_user_id) VALUES ${values.join(', ')}`);
    console.log('Params:', params);
    
    await client.query(`
      INSERT INTO match_events (match_id, event_type, user_id, minute, position, target_user_id)
      VALUES ${values.join(', ')}
    `, params);
    
    await client.query('ROLLBACK');
    console.log('Success');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}
run();
