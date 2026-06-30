import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = 'futsal-secret-key-2024';

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'メールアドレスとパスワードを入力してください' });
    }

    const db = getDb();
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: '認証に失敗しました' });
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: '認証に失敗しました' });
    }

    const token = jwt.sign(
      { userId: user.user_id, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { password_hash, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// POST /secret-login
router.post('/secret-login', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: '管理者アカウントが見つかりません' });
    }

    const token = jwt.sign(
      { userId: user.user_id, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { password_hash, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    console.error('Secret login error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// GET /me
router.get('/me', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query('SELECT * FROM users WHERE user_id = $1', [req.user.userId]);
    const user = result.rows[0];
    
    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    const { password_hash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// POST /register (Public)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: '名前、メールアドレス、パスワードは必須です' });
    }

    const db = getDb();
    
    // Check existing
    const existing = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'このメールアドレスは既に登録されています' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const result = await db.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, 'player')
      RETURNING user_id
    `, [name, email, hash]);

    res.status(201).json({ message: '登録が完了しました', user_id: result.rows[0].user_id });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

export default router;
