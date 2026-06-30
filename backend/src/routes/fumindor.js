import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET / - フミンドール一覧（年間MVP）
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(`
      SELECT f.*, u.name, u.jersey_number, u.position, u.photo_url
      FROM fumindor f
      JOIN users u ON f.user_id = u.user_id
      ORDER BY f.year DESC
    `);
    res.json({ awards: result.rows });
  } catch (err) {
    console.error('Get fumindor error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// POST / - フミンドール登録（admin only）
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { year, user_id, description } = req.body;

    if (!year || !user_id) {
      return res.status(400).json({ error: '年度と選手は必須です' });
    }

    const parsedYear = parseInt(year, 10);
    const parsedUserId = parseInt(user_id, 10);

    if (isNaN(parsedYear) || isNaN(parsedUserId)) {
      return res.status(400).json({ error: '年度と選手は正しい数値である必要があります' });
    }

    const yearMatchesQuery = `SELECT match_id FROM matches WHERE EXTRACT(YEAR FROM date::date) = $2`;
    const statsResult = await db.query(`
      SELECT 
        SUM(goals) as goals,
        SUM(assists) as assists,
        SUM(saves) as saves,
        SUM(minutes_played) as minutes_played,
        COUNT(match_id) as matches_played
      FROM match_stats
      WHERE user_id = $1 AND match_id IN (${yearMatchesQuery})
    `, [parsedUserId, parsedYear]);

    const totalEventsRes = await db.query(`SELECT COUNT(*) as count FROM events WHERE EXTRACT(YEAR FROM date_time::timestamp) = $1 AND date_time::timestamp < CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'`, [parsedYear]);
    const totalMatchesRes = await db.query(`SELECT COUNT(*) as count FROM matches WHERE EXTRACT(YEAR FROM date::date) = $1`, [parsedYear]);
    const totalEvents = parseInt(totalEventsRes.rows[0].count, 10) + parseInt(totalMatchesRes.rows[0].count, 10);

    const attendancesRes = await db.query(`
      SELECT COUNT(*) as count FROM attendances a 
      JOIN events e ON a.event_id = e.event_id 
      WHERE a.user_id = $1 AND a.status = 'present' AND EXTRACT(YEAR FROM e.date_time::timestamp) = $2 AND e.date_time::timestamp < CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'
    `, [parsedUserId, parsedYear]);

    const row = statsResult.rows[0];
    const goals = parseInt(row.goals, 10) || 0;
    const assists = parseInt(row.assists, 10) || 0;
    const saves = parseInt(row.saves, 10) || 0;
    const minutes_played = parseInt(row.minutes_played, 10) || 0;
    const matches_played = parseInt(row.matches_played, 10) || 0;
    
    const presentCount = parseInt(attendancesRes.rows[0].count, 10) + matches_played;
    const attendance_rate = totalEvents > 0 ? (presentCount / totalEvents) * 100 : 0;

    const result = await db.query(`
      INSERT INTO fumindor (year, user_id, goals, assists, matches_played, saves, minutes_played, attendance_rate, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING fumindor_id
    `, [parsedYear, parsedUserId, goals, assists, matches_played, saves, minutes_played, attendance_rate, description || null]);

    const awardResult = await db.query(`
      SELECT f.*, u.name, u.jersey_number, u.position
      FROM fumindor f
      JOIN users u ON f.user_id = u.user_id
      WHERE f.fumindor_id = $1
    `, [result.rows[0].fumindor_id]);

    res.status(201).json(awardResult.rows[0]);
  } catch (err) {
    if (err.message.includes('unique constraint') || err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'この年度のMVPは既に登録されています' });
    }
    console.error('Create fumindor error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// DELETE /:id - フミンドール削除（admin only）
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    await db.query('DELETE FROM fumindor WHERE fumindor_id = $1', [req.params.id]);
    res.json({ message: '削除しました' });
  } catch (err) {
    console.error('Delete fumindor error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

export default router;
