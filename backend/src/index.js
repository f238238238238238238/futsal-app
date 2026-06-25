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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// CORS設定
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// JSON bodyパーサー
app.use(express.json());

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
app.use('/api/fumindor', fumindorRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// DB初期化 & サーバー起動
initializeDb();

app.listen(PORT, () => {
  console.log(`Futsal API server running on http://localhost:${PORT}`);
});

export default app;
