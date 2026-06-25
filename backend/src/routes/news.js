import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET / - ニュース一覧
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { category, limit } = req.query;
    
    let query = 'SELECT * FROM news';
    const params = [];

    if (category) {
      query += ' WHERE category = $1';
      params.push(category);
    }

    query += ' ORDER BY created_at DESC';

    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(parseInt(limit, 10));
    }

    const result = await db.query(query, params);
    res.json({ news: result.rows });
  } catch (err) {
    console.error('Get news error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// GET /:id - ニュース詳細
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query('SELECT * FROM news WHERE news_id = $1', [req.params.id]);
    const newsItem = result.rows[0];

    if (!newsItem) {
      return res.status(404).json({ error: 'ニュースが見つかりません' });
    }
    res.json(newsItem);
  } catch (err) {
    console.error('Get news item error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// POST / - ニュース作成（admin only）
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { title, content, category, image_url } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'タイトルは必須です' });
    }

    const result = await db.query(`
      INSERT INTO news (title, content, category, image_url)
      VALUES ($1, $2, $3, $4)
      RETURNING news_id
    `, [title, content || null, category || 'お知らせ', image_url || null]);

    const newResult = await db.query('SELECT * FROM news WHERE news_id = $1', [result.rows[0].news_id]);
    res.status(201).json(newResult.rows[0]);
  } catch (err) {
    console.error('Create news error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// PUT /:id - ニュース編集（admin only）
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { title, content, category, image_url } = req.body;

    const existingResult = await db.query('SELECT * FROM news WHERE news_id = $1', [req.params.id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'ニュースが見つかりません' });
    }

    await db.query(`
      UPDATE news
      SET title = $1, content = $2, category = $3, image_url = $4, updated_at = CURRENT_TIMESTAMP
      WHERE news_id = $5
    `, [title, content, category, image_url, req.params.id]);

    const updatedResult = await db.query('SELECT * FROM news WHERE news_id = $1', [req.params.id]);
    res.json(updatedResult.rows[0]);
  } catch (err) {
    console.error('Update news error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// DELETE /:id - ニュース削除（admin only）
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    await db.query('DELETE FROM news WHERE news_id = $1', [req.params.id]);
    res.json({ message: '削除しました' });
  } catch (err) {
    console.error('Delete news error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

export default router;
