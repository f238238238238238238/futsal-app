import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET / - イベント一覧（今後のイベント）
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    
    // 過去の未開催イベントを削除（日時の文字列比較で過去判定）
    // date_timeが 'YYYY-MM-DD' などの形式なので、現在日付の文字列と比較する（今日の日付より前なら削除）
    await db.query(`
      DELETE FROM events 
      WHERE left(date_time, 10) < to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD')
      AND (is_held = false OR is_held IS NULL)
    `);

    // 過去のイベントも少し含めるか、未来のみにするか。とりあえず全件新しい順
    const result = await db.query('SELECT * FROM events ORDER BY date_time ASC');
    res.json({ events: result.rows });
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// GET /:id - イベント詳細
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query('SELECT * FROM events WHERE event_id = $1', [req.params.id]);
    const event = result.rows[0];
    if (!event) {
      return res.status(404).json({ error: 'イベントが見つかりません' });
    }
    res.json(event);
  } catch (err) {
    console.error('Get event error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// POST / - イベント作成（admin only）
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { title, event_type, date_time, location, description } = req.body;

    if (!title || !date_time) {
      return res.status(400).json({ error: 'タイトルと日時は必須です' });
    }

    const result = await db.query(`
      INSERT INTO events (title, event_type, date_time, location, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING event_id
    `, [title, event_type || 'other', date_time, location || null, description || null]);

    const newEventResult = await db.query('SELECT * FROM events WHERE event_id = $1', [result.rows[0].event_id]);
    res.status(201).json(newEventResult.rows[0]);
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// PUT /:id - イベント編集（admin only）
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { title, event_type, date_time, location, description } = req.body;

    const existingResult = await db.query('SELECT * FROM events WHERE event_id = $1', [req.params.id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'イベントが見つかりません' });
    }

    await db.query(`
      UPDATE events
      SET title = $1, event_type = $2, date_time = $3, location = $4, description = $5
      WHERE event_id = $6
    `, [title, event_type, date_time, location, description, req.params.id]);

    const updatedResult = await db.query('SELECT * FROM events WHERE event_id = $1', [req.params.id]);
    res.json(updatedResult.rows[0]);
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// DELETE /:id - イベント削除（admin only）
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    await db.query('DELETE FROM events WHERE event_id = $1', [req.params.id]);
    res.json({ message: 'イベントを削除しました' });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

export default router;
