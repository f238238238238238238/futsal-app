import bcrypt from 'bcryptjs';
import { initializeDb, getDb, closeDb } from './database.js';

async function seed() {
  console.log('Initializing database connection...');
  initializeDb();
  
  // Wait a moment for connection pool to be ready (though usually not strictly required, good for safety)
  await new Promise(r => setTimeout(r, 1000));
  const pool = getDb();

  console.log('Clearing existing data...');
  // PostgreSQLでは CASCADE を使ってテーブルを削除またはTRUNCATEする方が早いですが、
  // ここではテーブルごと削除して再作成する方針にします（schema.sqlの制約エラーを防ぐため）
  await pool.query(`
    DROP TABLE IF EXISTS match_events CASCADE;
    DROP TABLE IF EXISTS match_stats CASCADE;
    DROP TABLE IF EXISTS attendances CASCADE;
    DROP TABLE IF EXISTS matches CASCADE;
    DROP TABLE IF EXISTS events CASCADE;
    DROP TABLE IF EXISTS news CASCADE;
    DROP TABLE IF EXISTS fumindor CASCADE;
    DROP TABLE IF EXISTS site_settings CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `);

  // スキーマを再度実行してテーブルを作り直す
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);

  console.log('Seeding users...');
  const adminHash = bcrypt.hashSync('admin123', 10);
  const playerHash = bcrypt.hashSync('player123', 10);

  const insertUserQuery = `
    INSERT INTO users (name, email, password_hash, role, jersey_number, position,
      dominant_foot, birth_date, height, weight, photo_url,
      catchphrase, reason_started, hobby, season_goal, favorite_shoes,
      salary, stat_offense, stat_defense, stat_kick, stat_speed, stat_technique, stat_stamina)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
    RETURNING user_id
  `;

  // 管理者
  await pool.query(insertUserQuery, [
    '山田 太郎', 'admin@futsal.com', adminHash, 'admin', null, null,
    null, '1985-03-15', 175, 72, null,
    'チームを勝利へ導く', null, 'サッカー観戦', null, null,
    0, 50, 50, 50, 50, 50, 50
  ]);

  // 選手12名
  const players = [
    // ゴレイロ 2名
    {
      name: '佐藤 健太', email: 'sato@futsal.com', jersey: 1, position: 'ゴレイロ',
      foot: '右足', birth: '1998-04-12', height: 180, weight: 75,
      catchphrase: '絶対に止める！', reason: '小学校の時にフットサルの試合を見て感動した',
      hobby: '映画鑑賞', goal: '無失点試合を5回達成', shoes: 'デスポルチ・カンピーナスJP5',
      salary: 3200000,
      offense: 35, defense: 88, kick: 65, speed: 60, technique: 72, stamina: 75
    },
    {
      name: '高橋 悠斗', email: 'takahashi@futsal.com', jersey: 12, position: 'ゴレイロ',
      foot: '右足', birth: '2000-08-25', height: 178, weight: 73,
      catchphrase: '守護神はここにいる', reason: '友達に誘われて始めた',
      hobby: 'ギター演奏', goal: 'セービング技術を磨く', shoes: 'ミズノ・バサラ',
      salary: 2400000,
      offense: 30, defense: 82, kick: 58, speed: 55, technique: 65, stamina: 70
    },
    // フィクソ 3名
    {
      name: '田中 翔太', email: 'tanaka@futsal.com', jersey: 2, position: 'フィクソ',
      foot: '右足', birth: '1997-01-20', height: 172, weight: 68,
      catchphrase: '堅守速攻の要', reason: '中学からずっとフットサル一筋',
      hobby: '筋トレ', goal: 'ディフェンスリーダーとしてチームを支える', shoes: 'アシックス・カルチェットWD8',
      salary: 3500000,
      offense: 45, defense: 90, kick: 60, speed: 72, technique: 68, stamina: 85
    },
    {
      name: '渡辺 大輝', email: 'watanabe@futsal.com', jersey: 3, position: 'フィクソ',
      foot: '左足', birth: '1999-06-08', height: 170, weight: 65,
      catchphrase: '冷静に、確実に', reason: 'サッカーからフットサルに転向した',
      hobby: '読書', goal: 'ビルドアップの精度を上げる', shoes: 'ナイキ・ルナガトII',
      salary: 2800000,
      offense: 40, defense: 85, kick: 70, speed: 65, technique: 75, stamina: 78
    },
    {
      name: '伊藤 蓮', email: 'ito@futsal.com', jersey: 4, position: 'フィクソ',
      foot: '右足', birth: '1996-11-03', height: 175, weight: 70,
      catchphrase: '最後の砦', reason: '大学のサークルで始めた',
      hobby: '料理', goal: 'セットプレーからの得点を増やす', shoes: 'プーマ・フューチャーZ',
      salary: 3000000,
      offense: 55, defense: 83, kick: 75, speed: 60, technique: 70, stamina: 80
    },
    // アラ 4名
    {
      name: '中村 颯太', email: 'nakamura@futsal.com', jersey: 7, position: 'アラ',
      foot: '右足', birth: '1998-09-14', height: 168, weight: 63,
      catchphrase: 'スピードで切り裂く', reason: '兄の影響でフットサルを始めた',
      hobby: 'ゲーム', goal: '10ゴール10アシスト達成', shoes: 'ミズノ・モレリアIN',
      salary: 5000000,
      offense: 88, defense: 45, kick: 80, speed: 92, technique: 85, stamina: 78
    },
    {
      name: '小林 拓海', email: 'kobayashi@futsal.com', jersey: 8, position: 'アラ',
      foot: '左足', birth: '2001-02-28', height: 165, weight: 60,
      catchphrase: 'テクニックで魅せる', reason: 'YouTube でフットサルの動画を見てハマった',
      hobby: '音楽制作', goal: 'ドリブル突破からのチャンスメイク', shoes: 'アディダス・トップサラ',
      salary: 3800000,
      offense: 75, defense: 40, kick: 72, speed: 80, technique: 92, stamina: 70
    },
    {
      name: '加藤 陽向', email: 'kato@futsal.com', jersey: 10, position: 'アラ',
      foot: '右足', birth: '1997-12-05', height: 171, weight: 66,
      catchphrase: '10番の誇りを胸に', reason: 'プロフットサル選手に憧れて',
      hobby: 'カフェ巡り', goal: 'チームのエースとして得点王を目指す', shoes: 'デスポルチ・サンルイスKI3',
      salary: 5500000,
      offense: 85, defense: 50, kick: 88, speed: 75, technique: 90, stamina: 82
    },
    {
      name: '松本 海斗', email: 'matsumoto@futsal.com', jersey: 11, position: 'アラ',
      foot: '右足', birth: '2000-05-17', height: 169, weight: 64,
      catchphrase: '走り続ける', reason: '高校の部活で始めた',
      hobby: 'ランニング', goal: 'プレス強度を上げてボール奪取数チーム1位', shoes: 'ナイキ・ストリートガト',
      salary: 2600000,
      offense: 60, defense: 65, kick: 55, speed: 85, technique: 62, stamina: 95
    },
    // ピヴォ 3名
    {
      name: '吉田 大和', email: 'yoshida@futsal.com', jersey: 9, position: 'ピヴォ',
      foot: '右足', birth: '1996-07-22', height: 178, weight: 76,
      catchphrase: 'ゴールは俺が決める', reason: 'サッカーのFWからフットサルのピヴォに転向',
      hobby: 'バーベキュー', goal: 'シーズン15ゴール', shoes: 'アシックス・デスタッキ',
      salary: 4800000,
      offense: 90, defense: 35, kick: 85, speed: 68, technique: 78, stamina: 75
    },
    {
      name: '山本 樹', email: 'yamamoto@futsal.com', jersey: 5, position: 'ピヴォ',
      foot: '左足', birth: '1999-03-30', height: 176, weight: 74,
      catchphrase: 'ポストプレーならお任せ', reason: 'フットサル場の体験会がきっかけ',
      hobby: '写真撮影', goal: 'ポストプレーの成功率を80%に', shoes: 'ミズノ・モナルシーダNEO',
      salary: 3600000,
      offense: 78, defense: 55, kick: 70, speed: 60, technique: 82, stamina: 72
    },
    {
      name: '井上 悠真', email: 'inoue@futsal.com', jersey: 6, position: 'ピヴォ',
      foot: '右足', birth: '2001-10-09', height: 174, weight: 71,
      catchphrase: '裏を取る天才', reason: '友人のチームに助っ人で出たのがきっかけ',
      hobby: 'アニメ', goal: 'オフザボールの動きを極める', shoes: 'プーマ・ウルトラプレー',
      salary: 3000000,
      offense: 80, defense: 42, kick: 68, speed: 82, technique: 75, stamina: 78
    },
  ];

  for (const p of players) {
    await pool.query(insertUserQuery, [
      p.name, p.email, playerHash, 'player', p.jersey, p.position,
      p.foot, p.birth, p.height, p.weight, null,
      p.catchphrase, p.reason, p.hobby, p.goal, p.shoes,
      p.salary, p.offense, p.defense, p.kick, p.speed, p.technique, p.stamina
    ]);
  }

  console.log('Seeding matches...');
  const insertMatchQuery = `
    INSERT INTO matches (date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING match_id
  `;

  const matchesData = [
    {
      date: '2026-04-06', opponent: 'FC レッドスターズ', comp: '市民フットサルリーグ 第1節',
      our: 5, opp: 2, summary: '開幕戦を快勝。中村颯太のハットトリックが光り、チーム全体が攻守にわたって良いパフォーマンスを見せた。', mom: 8 // 中村颯太(8)
    },
    {
      date: '2026-04-13', opponent: 'ブルーオーシャンFC', comp: '市民フットサルリーグ 第2節',
      our: 3, opp: 3, summary: '激闘のドロー。前半2-1でリードするも後半に追いつかれ、終了間際に加藤のゴールで同点に追いついた粘りのゲーム。', mom: 10 // 加藤陽向(10)
    },
    {
      date: '2026-04-20', opponent: 'グリーンウィンズ', comp: '市民フットサルリーグ 第3節',
      our: 4, opp: 1, summary: '吉田大和の2ゴールを含む4得点で快勝。ディフェンス陣も安定し、佐藤健太のファインセーブが随所に光った。', mom: 11 // 吉田大和(11)
    },
  ];

  const matchIds = [];
  for (const m of matchesData) {
    const res = await pool.query(insertMatchQuery, [m.date, m.opponent, m.comp, m.our, m.opp, m.summary, m.mom]);
    matchIds.push(res.rows[0].match_id);
  }

  console.log('Seeding match stats...');
  const insertStatQuery = `
    INSERT INTO match_stats (match_id, user_id, is_starter, goals, assists)
    VALUES ($1, $2, $3, $4, $5)
  `;

  // 1試合目
  const statsData = [
    { matchIdx: 0, user: 2, starter: 1, goals: 0, assists: 0 },
    { matchIdx: 0, user: 4, starter: 1, goals: 0, assists: 1 },
    { matchIdx: 0, user: 7, starter: 1, goals: 3, assists: 0 }, // 中村
    { matchIdx: 0, user: 9, starter: 1, goals: 1, assists: 1 },
    { matchIdx: 0, user: 11, starter: 0, goals: 1, assists: 0 },
  ];

  for (const s of statsData) {
    await pool.query(insertStatQuery, [matchIds[s.matchIdx], s.user, s.starter, s.goals, s.assists]);
  }

  console.log('Seeding events...');
  const insertScheduleEvent = `
    INSERT INTO events (title, event_type, date_time, location, description)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING event_id
  `;

  const scheduleEvents = [
    { title: '通常練習', type: 'practice', dateTime: '2026-06-28T19:00:00', location: '市民体育館 Aコート', description: '基本的なパス回しとシュート練習。' },
    { title: '市民フットサルリーグ 第6節', type: 'match', dateTime: '2026-07-05T14:00:00', location: '総合スポーツセンター', description: 'vs ストームブレイカーズ。' },
  ];

  const eventIds = [];
  for (const ev of scheduleEvents) {
    const res = await pool.query(insertScheduleEvent, [ev.title, ev.type, ev.dateTime, ev.location, ev.description]);
    eventIds.push(res.rows[0].event_id);
  }

  console.log('Seeding attendances...');
  const insertAttendance = `
    INSERT INTO attendances (event_id, user_id, status, comment)
    VALUES ($1, $2, $3, $4)
  `;
  await pool.query(insertAttendance, [eventIds[0], 2, 'present', '参加します！']);
  await pool.query(insertAttendance, [eventIds[0], 3, 'present', null]);
  await pool.query(insertAttendance, [eventIds[0], 5, 'absent', '仕事のため欠席']);

  console.log('Seeding news...');
  const insertNews = `
    INSERT INTO news (title, content, category, image_url, created_at)
    VALUES ($1, $2, $3, $4, $5)
  `;
  const newsData = [
    { title: '市民フットサルリーグ第5節を終えて首位浮上！', content: '見事リーグ首位に立ちました。', category: '試合結果', image: null, date: '2026-06-16 10:00:00' },
    { title: '中村颯太選手が月間MVP受賞！', content: '開幕戦でのハットトリックを含む安定した得点力が評価されました。', category: '選手情報', image: null, date: '2026-05-01 11:00:00' },
  ];
  for (const n of newsData) {
    await pool.query(insertNews, [n.title, n.content, n.category, n.image, n.date]);
  }

  console.log('Seeding fumindor (annual MVP)...');
  const insertFumindor = `
    INSERT INTO fumindor (year, user_id, goals, assists, matches_played, description)
    VALUES ($1, $2, $3, $4, $5, $6)
  `;
  await pool.query(insertFumindor, [2023, 9, 18, 12, 20, 'チーム創設初年度のMVPに。']);
  await pool.query(insertFumindor, [2024, 7, 22, 8, 22, 'シーズン22ゴールはチーム記録。']);
  await pool.query(insertFumindor, [2025, 11, 15, 5, 18, 'チーム初のカップ戦ベスト4進出に貢献。']);

  console.log('Seeding site settings...');
  const insertSetting = 'INSERT INTO site_settings (key, value) VALUES ($1, $2)';
  await pool.query(insertSetting, ['hero_image_url', '']);
  await pool.query(insertSetting, ['team_name', 'FUMINTUS']);

  console.log('Seed data inserted successfully!');
  await closeDb();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
