import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

router.get('/goals', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(`
      SELECT u.user_id, u.name, u.photo_url, SUM(ms.goals) as total_goals
      FROM users u
      JOIN match_stats ms ON u.user_id = ms.user_id
      GROUP BY u.user_id
      HAVING SUM(ms.goals) > 0
      ORDER BY total_goals DESC, u.name ASC
      LIMIT 10
    `);
    res.json({ ranking: result.rows });
  } catch (err) {
    console.error('Get goals ranking error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

router.get('/assists', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(`
      SELECT u.user_id, u.name, u.photo_url, SUM(ms.assists) as total_assists
      FROM users u
      JOIN match_stats ms ON u.user_id = ms.user_id
      GROUP BY u.user_id
      HAVING SUM(ms.assists) > 0
      ORDER BY total_assists DESC, u.name ASC
      LIMIT 10
    `);
    res.json({ ranking: result.rows });
  } catch (err) {
    console.error('Get assists ranking error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

router.get('/attendance', async (req, res) => {
  try {
    const db = getDb();
    // イベント数と試合数を合計して全体の分母とする
    const totalEventsRes = await db.query(`SELECT COUNT(*) as count FROM events WHERE date_time::timestamp < CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'`);
    const totalMatchesRes = await db.query(`SELECT COUNT(*) as count FROM matches`);
    const totalEvents = parseInt(totalEventsRes.rows[0].count, 10) + parseInt(totalMatchesRes.rows[0].count, 10);

    const result = await db.query(`
      SELECT u.user_id, u.name, u.photo_url,
        (
          (SELECT COUNT(*) FROM attendances a JOIN events e ON a.event_id = e.event_id WHERE a.user_id = u.user_id AND a.status = 'present' AND e.date_time::timestamp < CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo') +
          (SELECT COUNT(*) FROM match_stats ms WHERE ms.user_id = u.user_id)
        ) as present_count
      FROM users u
      WHERE (
        (SELECT COUNT(*) FROM attendances a JOIN events e ON a.event_id = e.event_id WHERE a.user_id = u.user_id AND a.status = 'present' AND e.date_time::timestamp < CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo') +
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

    res.json({ ranking });
  } catch (err) {
    console.error('Get attendance ranking error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

router.get('/stamina', async (req, res) => {
  try {
    const db = getDb();
    // 体力王は出場時間の合計で計算
    const result = await db.query(`
      SELECT u.user_id, u.name, u.photo_url, SUM(ms.minutes_played) as total_minutes
      FROM users u
      JOIN match_stats ms ON u.user_id = ms.user_id
      GROUP BY u.user_id
      HAVING SUM(ms.minutes_played) > 0
      ORDER BY total_minutes DESC, u.name ASC
      LIMIT 10
    `);
    res.json({ ranking: result.rows });
  } catch (err) {
    console.error('Get stamina ranking error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

export default router;
