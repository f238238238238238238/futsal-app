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
    const { year, user_id, goals, assists, matches_played, description } = req.body;

    if (!year || !user_id) {
      return res.status(400).json({ error: '年度と選手は必須です' });
    }

    const parsedYear = parseInt(year, 10);
    const parsedUserId = parseInt(user_id, 10);

    if (isNaN(parsedYear) || isNaN(parsedUserId)) {
      return res.status(400).json({ error: '年度と選手は正しい数値である必要があります' });
    }

    const result = await db.query(`
      INSERT INTO fumindor (year, user_id, goals, assists, matches_played, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING fumindor_id
    `, [parsedYear, parsedUserId, parseInt(goals, 10) || 0, parseInt(assists, 10) || 0, parseInt(matches_played, 10) || 0, description || null]);

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
