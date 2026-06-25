import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /event/:eventId - 特定イベントの出欠状況
router.get('/event/:eventId', async (req, res) => {
  try {
    const db = getDb();
    const eventId = req.params.eventId;

    // 全選手のリストを取得し、attendancesをLEFT JOINする
    const result = await db.query(`
      SELECT 
        u.user_id, u.name, u.photo_url, u.jersey_number,
        COALESCE(a.status, 'pending') as status,
        a.comment,
        a.updated_at
      FROM users u
      LEFT JOIN attendances a ON u.user_id = a.user_id AND a.event_id = $1
      ORDER BY u.jersey_number ASC
    `, [eventId]);

    const summaryResult = await db.query(`
      SELECT 
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent,
        COUNT(CASE WHEN status = 'pending' OR status IS NULL THEN 1 END) as pending
      FROM users u
      LEFT JOIN attendances a ON u.user_id = a.user_id AND a.event_id = $1
    `, [eventId]);

    res.json({
      attendances: result.rows,
      summary: summaryResult.rows[0]
    });
  } catch (err) {
    console.error('Get attendances error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// PUT / - 出欠回答更新（認証不要）
router.put('/', async (req, res) => {
  try {
    const db = getDb();
    const { event_id, status, comment, user_id } = req.body;

    if (!event_id || !status || !user_id) {
      return res.status(400).json({ error: 'イベントID、ステータス、ユーザーIDは必須です' });
    }

    await db.query(`
      INSERT INTO attendances (event_id, user_id, status, comment, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (event_id, user_id) 
      DO UPDATE SET status = EXCLUDED.status, comment = EXCLUDED.comment, updated_at = CURRENT_TIMESTAMP
    `, [event_id, user_id, status, comment || null]);

    res.json({ message: '出欠を更新しました' });
  } catch (err) {
    console.error('Update attendance error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

export default router;
