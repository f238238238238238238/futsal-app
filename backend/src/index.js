import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDb } from './db/database.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import matchesRoutes from './routes/matches.js';
import rankingsRoutes from './routes/rankings.js';
import eventsRoutes from './routes/events.js';
import attendancesRoutes from './routes/attendances.js';
import newsRoutes from './routes/news.js';
import fumindorRoutes from './routes/fumindor.js';
import settingsRoutes from './routes/settings.js';
import uploadRoutes from './routes/upload.js';
import lineRoutes from './routes/line.js';
import cronRoutes from './routes/cron.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// CORS設定
app.use(cors({
  origin: function (origin, callback) {
    callback(null, true);
  },
  credentials: true
}));

// JSON bodyパーサー (大容量Base64画像に対応)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 静的ファイル配信
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ルート登録
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/rankings', rankingsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/attendances', attendancesRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/line', lineRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/fumindor', fumindorRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const { getDb } = await import('./db/database.js');
    const db = getDb();
    const result = await db.query('SELECT 1 as val');
    res.json({ ok: true, val: result.rows[0].val });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.get('/api/test-scrape', async (req, res) => {
  try {
    const fetchRes = await fetch('https://labola.jp/r/event/3014/tournament', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
      }
    });
    const status = fetchRes.status;
    const html = await fetchRes.text();
    res.json({ status, htmlLength: html.length, preview: html.substring(0, 500) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DB初期化 & サーバー起動
initializeDb();

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Futsal API server running on http://localhost:${PORT}`);
  });
}

export default app;
