import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET / - 設定一覧
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query('SELECT key, value FROM site_settings');
    
    // key-valueの配列をオブジェクトに変換
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    
    res.json({ settings });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// PUT /:key - 特定の設定を更新（admin only）
router.put('/:key', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: '値(value)は必須です' });
    }

    await db.query(`
      INSERT INTO site_settings (key, value)
      VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `, [key, value]);

    res.json({ message: '設定を保存しました', key, value });
  } catch (err) {
    console.error('Update setting error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

export default router;
