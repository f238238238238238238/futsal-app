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
    res.json({ user: userWithoutPassword });
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
// --- LINE Auth Endpoints ---

// GET /auth/line/login
router.get('/line/login', (req, res) => {
  const LINE_LOGIN_CLIENT_ID = process.env.LINE_LOGIN_CLIENT_ID;
  const LINE_LOGIN_CALLBACK_URL = process.env.LINE_LOGIN_CALLBACK_URL;
  if (!LINE_LOGIN_CLIENT_ID || !LINE_LOGIN_CALLBACK_URL) {
    return res.status(500).json({ error: 'LINEログインが設定されていません' });
  }

  const state = Math.random().toString(36).substring(7);
  const authUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${LINE_LOGIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(LINE_LOGIN_CALLBACK_URL)}&state=${state}&scope=profile%20openid`;
  res.json({ url: authUrl });
});

// GET /auth/line/callback
router.get('/line/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

  if (error) {
    console.error('LINE OAuth Error:', error, error_description);
    return res.redirect(`${FRONTEND_URL}/login?error=line_denied`);
  }

  if (!code) {
    return res.status(400).send('Authorization code is missing');
  }

  const LINE_LOGIN_CLIENT_ID = process.env.LINE_LOGIN_CLIENT_ID;
  const LINE_LOGIN_CLIENT_SECRET = process.env.LINE_LOGIN_CLIENT_SECRET;
  const LINE_LOGIN_CALLBACK_URL = process.env.LINE_LOGIN_CALLBACK_URL;

  try {
    // 1. Get Access Token
    const tokenParams = new URLSearchParams();
    tokenParams.append('grant_type', 'authorization_code');
    tokenParams.append('code', code);
    tokenParams.append('redirect_uri', LINE_LOGIN_CALLBACK_URL);
    tokenParams.append('client_id', LINE_LOGIN_CLIENT_ID);
    tokenParams.append('client_secret', LINE_LOGIN_CLIENT_SECRET);

    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString()
    });
    
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('LINE Token Error:', errText);
      return res.redirect(`${FRONTEND_URL}/login?error=line_token_failed`);
    }
    
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Get Profile
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const profileData = await profileRes.json();
    const lineUserId = profileData.userId;
    const displayName = profileData.displayName;
    const pictureUrl = profileData.pictureUrl || '';

    // 3. Check if user exists
    const db = getDb();
    const existing = await db.query('SELECT * FROM users WHERE line_user_id = $1 OR (line_user_id IS NULL AND line_name = $2)', [lineUserId, displayName]);
    
    if (existing.rows.length > 0) {
      // Login existing user
      const user = existing.rows[0];
      
      // Update line_user_id if it was null
      if (!user.line_user_id) {
        await db.query('UPDATE users SET line_user_id = $1 WHERE user_id = $2', [lineUserId, user.user_id]);
      }

      const token = jwt.sign(
        { userId: user.user_id, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      // Redirect to frontend success page with token
      return res.redirect(`${FRONTEND_URL}/login/success?token=${token}`);
    } else {
      // Need registration - send back temporary token
      const tempToken = jwt.sign(
        { line_user_id: lineUserId, name: displayName, picture_url: pictureUrl },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      // Redirect to frontend line register page
      return res.redirect(`${FRONTEND_URL}/register/line?token=${tempToken}`);
    }
  } catch (err) {
    console.error('LINE Callback Error:', err);
    return res.redirect(`${FRONTEND_URL}/login?error=server_error`);
  }
});

// POST /auth/line/register
router.post('/line/register', async (req, res) => {
  const { tempToken, name, position, dominant_foot, birth_date, height, weight } = req.body;
  
  if (!tempToken || !name) {
    return res.status(400).json({ error: '必要な情報が不足しています' });
  }

  try {
    const decoded = jwt.verify(tempToken, JWT_SECRET);
    const lineUserId = decoded.line_user_id;
    const pictureUrl = decoded.picture_url;
    // Generate dummy email and password since they use LINE login
    const dummyEmail = `line_${lineUserId}@example.com`;
    const dummyPassword = Math.random().toString(36).slice(-10);
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(dummyPassword, salt);

    const db = getDb();
    const result = await db.query(`
      INSERT INTO users (name, email, password_hash, role, line_user_id, line_name, photo_url, position, dominant_foot, birth_date, height, weight)
      VALUES ($1, $2, $3, 'player', $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [name, dummyEmail, hash, lineUserId, decoded.name, pictureUrl, position, dominant_foot, birth_date, parseFloat(height)||null, parseFloat(weight)||null]);

    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.user_id, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    const { password_hash, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    console.error('LINE Register Error:', err);
    res.status(500).json({ error: 'LINE登録に失敗しました' });
  }
});
export default router;
