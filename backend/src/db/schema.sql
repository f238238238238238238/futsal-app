-- ユーザー（選手）テーブル
CREATE TABLE IF NOT EXISTS users (
  user_id    SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role       TEXT DEFAULT 'player' CHECK(role IN ('admin','player')),
  jersey_number INTEGER,
  position   TEXT,
  dominant_foot TEXT,
  birth_date TEXT,
  height     REAL,
  weight     REAL,
  photo_url  TEXT,
  catchphrase TEXT,
  reason_started TEXT,
  hobby      TEXT,
  season_goal TEXT,
  favorite_shoes TEXT,
  salary     INTEGER DEFAULT 0,
  stat_offense INTEGER DEFAULT 50,
  stat_defense INTEGER DEFAULT 50,
  stat_kick INTEGER DEFAULT 50,
  stat_speed INTEGER DEFAULT 50,
  stat_technique INTEGER DEFAULT 50,
  stat_stamina INTEGER DEFAULT 50,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 試合テーブル
CREATE TABLE IF NOT EXISTS matches (
  match_id        SERIAL PRIMARY KEY,
  date            TEXT NOT NULL,
  opponent_name   TEXT NOT NULL,
  competition_name TEXT,
  our_score       INTEGER DEFAULT 0,
  opponent_score  INTEGER DEFAULT 0,
  summary_text    TEXT,
  mom_user_id     INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 試合統計テーブル
CREATE TABLE IF NOT EXISTS match_stats (
  stat_id    SERIAL PRIMARY KEY,
  match_id   INTEGER NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(user_id),
  is_starter INTEGER DEFAULT 0,
  goals      INTEGER DEFAULT 0,
  assists    INTEGER DEFAULT 0
);

-- ゴールイベント（時系列記録）
CREATE TABLE IF NOT EXISTS match_events (
  event_id   SERIAL PRIMARY KEY,
  match_id   INTEGER NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  event_type TEXT CHECK(event_type IN ('goal','assist')),
  user_id    INTEGER NOT NULL REFERENCES users(user_id),
  minute     INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- スケジュール・イベントテーブル
CREATE TABLE IF NOT EXISTS events (
  event_id    SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  event_type  TEXT CHECK(event_type IN ('match','practice','other')),
  date_time   TEXT NOT NULL,
  location    TEXT,
  description TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 出欠テーブル
CREATE TABLE IF NOT EXISTS attendances (
  attendance_id SERIAL PRIMARY KEY,
  event_id      INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(user_id),
  status        TEXT DEFAULT 'pending' CHECK(status IN ('present','absent','pending')),
  comment       TEXT,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id)
);

-- ニューステーブル
CREATE TABLE IF NOT EXISTS news (
  news_id    SERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  content    TEXT,
  category   TEXT,
  image_url  TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- フミンドール（年間MVP）テーブル
CREATE TABLE IF NOT EXISTS fumindor (
  fumindor_id    SERIAL PRIMARY KEY,
  year           INTEGER UNIQUE NOT NULL,
  user_id        INTEGER NOT NULL REFERENCES users(user_id),
  goals          INTEGER DEFAULT 0,
  assists        INTEGER DEFAULT 0,
  matches_played INTEGER DEFAULT 0,
  description    TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- サイト設定テーブル
CREATE TABLE IF NOT EXISTS site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
