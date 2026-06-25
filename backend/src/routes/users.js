import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

const USER_FIELDS = 'user_id, name, email, role, jersey_number, position, dominant_foot, birth_date, height, weight, photo_url, catchphrase, reason_started, hobby, season_goal, favorite_shoes, salary, stat_offense, stat_defense, stat_kick, stat_speed, stat_technique, stat_stamina, created_at, updated_at';

// GET / - 全選手一覧
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { position } = req.query;
    let query = `SELECT ${USER_FIELDS} FROM users`;
    const params = [];

    if (position) {
      query += ' WHERE position = $1';
      params.push(position);
    }

    query += ' ORDER BY jersey_number ASC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// GET /:id - 選手詳細
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(`SELECT ${USER_FIELDS} FROM users WHERE user_id = $1`, [req.params.id]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: '選手が見つかりません' });
    }

    const statsResult = await db.query(`
      SELECT
        COUNT(DISTINCT ms.match_id) as matches_played,
        COALESCE(SUM(ms.goals), 0) as total_goals,
        COALESCE(SUM(ms.assists), 0) as total_assists
      FROM match_stats ms
      WHERE ms.user_id = $1
    `, [req.params.id]);

    const stats = statsResult.rows[0];
    res.json({ ...user, ...stats });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// POST / - 新規選手登録（admin only）
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const {
      name, email, password, role, jersey_number, position,
      dominant_foot, birth_date, height, weight, photo_url,
      catchphrase, reason_started, hobby, season_goal, favorite_shoes,
      salary, stat_offense, stat_defense, stat_kick, stat_speed, stat_technique, stat_stamina
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: '名前は必須です' });
    }

    const safeEmail = email || `player_${Date.now()}@futsal.dummy`;
    const safePassword = password || `dummy_pass_${Date.now()}`;

    const passwordHash = bcrypt.hashSync(safePassword, 10);

    const result = await db.query(`
      INSERT INTO users (name, email, password_hash, role, jersey_number, position,
        dominant_foot, birth_date, height, weight, photo_url,
        catchphrase, reason_started, hobby, season_goal, favorite_shoes,
        salary, stat_offense, stat_defense, stat_kick, stat_speed, stat_technique, stat_stamina)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING user_id
    `, [
      name, safeEmail, passwordHash, role || 'player', jersey_number || null, position || null,
      dominant_foot || null, birth_date || null, height || null, weight || null, photo_url || null,
      catchphrase || null, reason_started || null, hobby || null, season_goal || null, favorite_shoes || null,
      salary || 0, stat_offense || 50, stat_defense || 50, stat_kick || 50, stat_speed || 50, stat_technique || 50, stat_stamina || 50
    ]);

    const newUserResult = await db.query(`SELECT ${USER_FIELDS} FROM users WHERE user_id = $1`, [result.rows[0].user_id]);
    res.status(201).json(newUserResult.rows[0]);
  } catch (err) {
    if (err.message.includes('unique constraint') || err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'このメールアドレスは既に登録されています' });
    }
    console.error('Create user error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// PUT /:id - 選手情報編集（admin only）
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const existingResult = await db.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
    const existing = existingResult.rows[0];
    if (!existing) {
      return res.status(404).json({ error: '選手が見つかりません' });
    }

    const {
      name, email, password, role, jersey_number, position,
      dominant_foot, birth_date, height, weight, photo_url,
      catchphrase, reason_started, hobby, season_goal, favorite_shoes,
      salary, stat_offense, stat_defense, stat_kick, stat_speed, stat_technique, stat_stamina
    } = req.body;

    // Prevent demoting admin
    if (existing.role === 'admin' && role && role !== 'admin') {
      return res.status(403).json({ error: '管理者権限を外すことはできません' });
    }

    let passwordHash = existing.password_hash;
    if (password) {
      passwordHash = bcrypt.hashSync(password, 10);
    }

    await db.query(`
      UPDATE users SET
        name = $1, email = $2, password_hash = $3, role = $4, jersey_number = $5, position = $6,
        dominant_foot = $7, birth_date = $8, height = $9, weight = $10, photo_url = $11,
        catchphrase = $12, reason_started = $13, hobby = $14, season_goal = $15, favorite_shoes = $16,
        salary = $17, stat_offense = $18, stat_defense = $19, stat_kick = $20, stat_speed = $21, stat_technique = $22, stat_stamina = $23,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $24
    `, [
      name || existing.name, email || existing.email, passwordHash, role || existing.role,
      jersey_number !== undefined ? jersey_number : existing.jersey_number,
      position || existing.position,
      dominant_foot || existing.dominant_foot, birth_date || existing.birth_date,
      height !== undefined ? height : existing.height,
      weight !== undefined ? weight : existing.weight,
      photo_url || existing.photo_url,
      catchphrase || existing.catchphrase, reason_started || existing.reason_started,
      hobby || existing.hobby, season_goal || existing.season_goal,
      favorite_shoes || existing.favorite_shoes,
      salary !== undefined ? salary : existing.salary,
      stat_offense !== undefined ? stat_offense : existing.stat_offense,
      stat_defense !== undefined ? stat_defense : existing.stat_defense,
      stat_kick !== undefined ? stat_kick : existing.stat_kick,
      stat_speed !== undefined ? stat_speed : existing.stat_speed,
      stat_technique !== undefined ? stat_technique : existing.stat_technique,
      stat_stamina !== undefined ? stat_stamina : existing.stat_stamina,
      req.params.id
    ]);

    const updatedResult = await db.query(`SELECT ${USER_FIELDS} FROM users WHERE user_id = $1`, [req.params.id]);
    res.json(updatedResult.rows[0]);
  } catch (err) {
    if (err.message.includes('unique constraint') || err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'このメールアドレスは既に登録されています' });
    }
    console.error('Update user error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// DELETE /:id - 退団処理（admin only）
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const existingResult = await db.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
    const existing = existingResult.rows[0];
    if (!existing) {
      return res.status(404).json({ error: '選手が見つかりません' });
    }
    
    if (existing.role === 'admin') {
      return res.status(403).json({ error: '管理者アカウントは削除できません' });
    }

    await db.query('DELETE FROM users WHERE user_id = $1', [req.params.id]);
    res.json({ message: '選手を削除しました' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

export default router;
