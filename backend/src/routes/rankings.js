import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

router.get('/goals', async (req, res) => {
  try {
    const db = getDb();
    const { year } = req.query;
    let query = `
      SELECT u.user_id, u.name, u.photo_url, SUM(ms.goals) as total_goals
      FROM users u
      JOIN match_stats ms ON u.user_id = ms.user_id
    `;
    const params = [];
    if (year && year !== 'all') {
      query += ` JOIN matches m ON ms.match_id = m.match_id WHERE EXTRACT(YEAR FROM m.date::date) = $1`;
      params.push(parseInt(year, 10));
    }
    query += `
      GROUP BY u.user_id
      HAVING SUM(ms.goals) > 0
      ORDER BY total_goals DESC, u.name ASC
      LIMIT 10
    `;
    const result = await db.query(query, params);
    res.json({ ranking: result.rows });
  } catch (err) {
    console.error('Get goals ranking error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

router.get('/assists', async (req, res) => {
  try {
    const db = getDb();
    const { year } = req.query;
    let query = `
      SELECT u.user_id, u.name, u.photo_url, SUM(ms.assists) as total_assists
      FROM users u
      JOIN match_stats ms ON u.user_id = ms.user_id
    `;
    const params = [];
    if (year && year !== 'all') {
      query += ` JOIN matches m ON ms.match_id = m.match_id WHERE EXTRACT(YEAR FROM m.date::date) = $1`;
      params.push(parseInt(year, 10));
    }
    query += `
      GROUP BY u.user_id
      HAVING SUM(ms.assists) > 0
      ORDER BY total_assists DESC, u.name ASC
      LIMIT 10
    `;
    const result = await db.query(query, params);
    res.json({ ranking: result.rows });
  } catch (err) {
    console.error('Get assists ranking error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

router.get('/attendance', async (req, res) => {
  try {
    const db = getDb();
    const { year } = req.query;
    const params = [];
    let yearFilterEvents = '';
    let yearFilterMatches = '';

    if (year && year !== 'all') {
      params.push(parseInt(year, 10));
      yearFilterEvents = ` AND EXTRACT(YEAR FROM e.date_time::timestamp) = $1`;
      yearFilterMatches = ` JOIN matches m ON ms.match_id = m.match_id WHERE EXTRACT(YEAR FROM m.date::date) = $1`;
    }

    const totalEventsRes = await db.query(`SELECT COUNT(*) as count FROM events e WHERE e.event_type = 'match' AND e.is_held = true${yearFilterEvents}`, params);
    const totalMatchesRes = await db.query(`SELECT COUNT(*) as count FROM matches m${year && year !== 'all' ? ` WHERE EXTRACT(YEAR FROM m.date::date) = $1` : ''}`, params);
    const totalEvents = parseInt(totalEventsRes.rows[0].count, 10) + parseInt(totalMatchesRes.rows[0].count, 10);

    const result = await db.query(`
      SELECT u.user_id, u.name, u.photo_url,
        (
          (SELECT COUNT(*) FROM attendances a JOIN events e ON a.event_id = e.event_id WHERE a.user_id = u.user_id AND a.status = 'present' AND e.is_held = true${yearFilterEvents}) +
          (SELECT COUNT(*) FROM match_stats ms${yearFilterMatches} ${year && year !== 'all' ? 'AND' : 'WHERE'} ms.user_id = u.user_id)
        ) as present_count
      FROM users u
      WHERE (
        (SELECT COUNT(*) FROM attendances a JOIN events e ON a.event_id = e.event_id WHERE a.user_id = u.user_id AND a.status = 'present' AND e.is_held = true${yearFilterEvents}) +
        (SELECT COUNT(*) FROM match_stats ms${yearFilterMatches} ${year && year !== 'all' ? 'AND' : 'WHERE'} ms.user_id = u.user_id)
      ) > 0
      ORDER BY present_count DESC, u.name ASC
      LIMIT 10
    `, params);

    const ranking = result.rows.map(r => ({
      ...r,
      total_events: totalEvents,
      rate: totalEvents > 0 ? Math.round((parseInt(r.present_count,10) / totalEvents) * 100) : 0
    }));

    res.json({ ranking });
  } catch (err) {
    console.error('Get attendance ranking error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

router.get('/stamina', async (req, res) => {
  try {
    const db = getDb();
    const { year } = req.query;
    let query = `
      SELECT u.user_id, u.name, u.photo_url, SUM(ms.minutes_played) as total_minutes
      FROM users u
      JOIN match_stats ms ON u.user_id = ms.user_id
    `;
    const params = [];
    if (year && year !== 'all') {
      query += ` JOIN matches m ON ms.match_id = m.match_id WHERE EXTRACT(YEAR FROM m.date::date) = $1`;
      params.push(parseInt(year, 10));
    }
    query += `
      GROUP BY u.user_id
      HAVING SUM(ms.minutes_played) > 0
      ORDER BY total_minutes DESC, u.name ASC
      LIMIT 10
    `;
    const result = await db.query(query, params);
    res.json({ ranking: result.rows });
  } catch (err) {
    console.error('Get stamina ranking error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

router.get('/saves', async (req, res) => {
  try {
    const db = getDb();
    const { year } = req.query;
    let query = `
      SELECT u.user_id, u.name, u.photo_url, SUM(ms.saves) as total_saves
      FROM users u
      JOIN match_stats ms ON u.user_id = ms.user_id
    `;
    const params = [];
    if (year && year !== 'all') {
      query += ` JOIN matches m ON ms.match_id = m.match_id WHERE EXTRACT(YEAR FROM m.date::date) = $1`;
      params.push(parseInt(year, 10));
    }
    query += `
      GROUP BY u.user_id
      HAVING SUM(ms.saves) > 0
      ORDER BY total_saves DESC, u.name ASC
      LIMIT 10
    `;
    const result = await db.query(query, params);
    res.json({ ranking: result.rows });
  } catch (err) {
    console.error('Get saves ranking error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

router.get('/defense', async (req, res) => {
  try {
    const db = getDb();
    const { year } = req.query;
    let query = `
      SELECT u.user_id, u.name, u.photo_url, COUNT(me.event_id) as total_defense
      FROM users u
      JOIN match_events me ON u.user_id = me.user_id AND me.event_type IN ('defense', 'steal', 'block', 'cut')
    `;
    const params = [];
    if (year && year !== 'all') {
      query += ` JOIN matches m ON me.match_id = m.match_id WHERE EXTRACT(YEAR FROM m.date::date) = $1`;
      params.push(parseInt(year, 10));
    }
    query += `
      GROUP BY u.user_id
      HAVING COUNT(me.event_id) > 0
      ORDER BY total_defense DESC, u.name ASC
      LIMIT 10
    `;
    const result = await db.query(query, params);
    res.json({ ranking: result.rows });
  } catch (err) {
    console.error('Get defense ranking error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

router.get('/shot_accuracy', async (req, res) => {
  try {
    const db = getDb();
    const { year } = req.query;
    let query = `
      SELECT u.user_id, u.name, u.photo_url, 
             SUM(ms.goals) as total_goals,
             (SELECT COUNT(*) FROM match_events me2 WHERE me2.user_id = u.user_id AND me2.event_type = 'shot' ${year && year !== 'all' ? `AND me2.match_id IN (SELECT match_id FROM matches WHERE EXTRACT(YEAR FROM date::date) = $1)` : ''}) as total_missed_shots
      FROM users u
      JOIN match_stats ms ON u.user_id = ms.user_id
    `;
    const params = [];
    if (year && year !== 'all') {
      query += ` JOIN matches m ON ms.match_id = m.match_id WHERE EXTRACT(YEAR FROM m.date::date) = $1`;
      params.push(parseInt(year, 10));
    }
    query += `
      GROUP BY u.user_id
      HAVING SUM(ms.goals) > 0
    `;
    const result = await db.query(query, params);
    
    // Calculate rate (goals / (goals + missed_shots))
    const ranking = result.rows.map(r => {
      const goals = parseInt(r.total_goals, 10) || 0;
      const misses = parseInt(r.total_missed_shots, 10) || 0;
      const shots = goals + misses;
      const rate = shots > 0 ? Math.round((goals / shots) * 100) : 0;
      return { ...r, rate, total_shots: shots };
    })
    .filter(r => r.total_shots >= 3) // 最低3本以上シュートを打っている人のみ
    .sort((a, b) => b.rate - a.rate || b.total_goals - a.total_goals)
    .slice(0, 10);

    res.json({ ranking });
  } catch (err) {
    console.error('Get shot accuracy ranking error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

export default router;
