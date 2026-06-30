import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

const USER_FIELDS = 'user_id, name, email, role, jersey_number, position, dominant_foot, birth_date, height, weight, photo_url, catchphrase, reason_started, hobby, season_goal, favorite_shoes, salary, stat_offense, stat_defense, stat_kick, stat_speed, stat_technique, stat_stamina, line_name, created_at, updated_at';

// GET / - 全選手一覧
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { position } = req.query;
    let query = `SELECT ${USER_FIELDS} FROM users WHERE role != 'admin'`;
    const params = [];

    if (position) {
      query += ' AND position = $1';
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

    // Get yearly match stats
    const yearlyMatchStatsResult = await db.query(`
      SELECT 
        EXTRACT(YEAR FROM m.date::date) as year,
        COUNT(DISTINCT ms.match_id) as matches_played,
        COALESCE(SUM(ms.goals), 0) as goals,
        COALESCE(SUM(ms.assists), 0) as assists,
        COALESCE(SUM(ms.saves), 0) as saves,
        COALESCE(SUM(ms.minutes_played), 0) as minutes_played
      FROM match_stats ms
      JOIN matches m ON ms.match_id = m.match_id
      WHERE ms.user_id = $1
      GROUP BY EXTRACT(YEAR FROM m.date::date)
    `, [req.params.id]);

    // Get yearly event attendances
    const yearlyAttendanceResult = await db.query(`
      SELECT 
        EXTRACT(YEAR FROM e.date_time::timestamp) as year,
        COUNT(a.event_id) as present_count
      FROM attendances a
      JOIN events e ON a.event_id = e.event_id
      WHERE a.user_id = $1 AND a.status = 'present' AND e.date_time::timestamp < CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'
      GROUP BY EXTRACT(YEAR FROM e.date_time::timestamp)
    `, [req.params.id]);

    const totalEventsResult = await db.query(`
      SELECT 
        EXTRACT(YEAR FROM date_time::timestamp) as year,
        COUNT(event_id) as total_events
      FROM events
      WHERE date_time::timestamp < CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'
      GROUP BY EXTRACT(YEAR FROM date_time::timestamp)
    `);

    const totalMatchesResult = await db.query(`
      SELECT 
        EXTRACT(YEAR FROM date::date) as year,
        COUNT(match_id) as total_matches
      FROM matches
      GROUP BY EXTRACT(YEAR FROM date::date)
    `);

    const matchStatsByYear = {};
    for (const row of yearlyMatchStatsResult.rows) {
      matchStatsByYear[row.year] = {
        matches_played: parseInt(row.matches_played, 10),
        goals: parseInt(row.goals, 10),
        assists: parseInt(row.assists, 10),
        saves: parseInt(row.saves, 10),
        minutes_played: parseInt(row.minutes_played, 10),
      };
    }

    const attendanceByYear = {};
    for (const row of yearlyAttendanceResult.rows) {
      attendanceByYear[row.year] = parseInt(row.present_count, 10);
    }

    const totalEventsByYear = {};
    for (const row of totalEventsResult.rows) {
      totalEventsByYear[row.year] = parseInt(row.total_events, 10);
    }
    for (const row of totalMatchesResult.rows) {
      totalEventsByYear[row.year] = (totalEventsByYear[row.year] || 0) + parseInt(row.total_matches, 10);
    }

    const yearlyStats = [];
    const allYears = new Set([...Object.keys(matchStatsByYear), ...Object.keys(attendanceByYear)]);
    
    // Default to current year if no data
    if (allYears.size === 0) {
      allYears.add(new Date().getFullYear().toString());
    }

    let total_matches_played = 0;
    let total_goals = 0;
    let total_assists = 0;
    let total_saves = 0;
    let total_minutes_played = 0;

    for (const year of Array.from(allYears).sort((a, b) => b - a)) {
      const ms = matchStatsByYear[year] || { matches_played: 0, goals: 0, assists: 0, saves: 0, minutes_played: 0 };
      const att = attendanceByYear[year] || 0;
      const totalEv = totalEventsByYear[year] || 0;
      const presentTotal = att + ms.matches_played;
      const attendance_rate = totalEv > 0 ? (presentTotal / totalEv) * 100 : 0;

      yearlyStats.push({
        year: parseInt(year, 10),
        ...ms,
        attendance_rate: attendance_rate
      });

      total_matches_played += ms.matches_played;
      total_goals += ms.goals;
      total_assists += ms.assists;
      total_saves += ms.saves;
      total_minutes_played += ms.minutes_played;
    }

    res.json({ 
      ...user, 
      yearlyStats, 
      total_matches_played, 
      total_goals, 
      total_assists, 
      total_saves, 
      total_minutes_played 
    });
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
      salary, stat_offense, stat_defense, stat_kick, stat_speed, stat_technique, stat_stamina, line_name
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
        salary, stat_offense, stat_defense, stat_kick, stat_speed, stat_technique, stat_stamina, line_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING user_id
    `, [
      name, safeEmail, passwordHash, role || 'player', jersey_number || null, position || null,
      dominant_foot || null, birth_date || null, height || null, weight || null, photo_url || null,
      catchphrase || null, reason_started || null, hobby || null, season_goal || null, favorite_shoes || null,
      salary || 0, stat_offense || 50, stat_defense || 50, stat_kick || 50, stat_speed || 50, stat_technique || 50, stat_stamina || 50, line_name || null
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

// PUT /:id - 選手情報編集（admin or self）
router.put('/:id', authenticate, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const requestingUserId = req.user.userId;
    const isAdmin = req.user.role === 'admin';

    // Allow if admin OR if the user is editing their own profile
    if (!isAdmin && targetUserId !== requestingUserId) {
      return res.status(403).json({ error: '他のユーザーの情報は編集できません' });
    }

    const db = getDb();
    const existingResult = await db.query('SELECT * FROM users WHERE user_id = $1', [targetUserId]);
    const existing = existingResult.rows[0];
    if (!existing) {
      return res.status(404).json({ error: '選手が見つかりません' });
    }

    const {
      name, email, password, role, jersey_number, position,
      dominant_foot, birth_date, height, weight, photo_url,
      catchphrase, reason_started, hobby, season_goal, favorite_shoes,
      salary, stat_offense, stat_defense, stat_kick, stat_speed, stat_technique, stat_stamina, line_name
    } = req.body;

    // Prevent demoting admin
    if (existing.role === 'admin' && role && role !== 'admin') {
      return res.status(403).json({ error: '管理者権限を外すことはできません' });
    }

    let passwordHash = existing.password_hash;
    if (password) {
      passwordHash = bcrypt.hashSync(password, 10);
    }

    const valOrExisting = (val, existing, type = 'string') => {
      if (val === undefined) return existing;
      if (type === 'number' || type === 'date') return val === '' ? null : val;
      return val;
    };

    // If not admin, restrict certain fields
    const finalRole = isAdmin ? (role || existing.role) : existing.role;
    const finalSalary = isAdmin ? valOrExisting(salary, existing.salary, 'number') : existing.salary;
    const finalStatOffense = isAdmin ? valOrExisting(stat_offense, existing.stat_offense, 'number') : existing.stat_offense;
    const finalStatDefense = isAdmin ? valOrExisting(stat_defense, existing.stat_defense, 'number') : existing.stat_defense;
    const finalStatKick = isAdmin ? valOrExisting(stat_kick, existing.stat_kick, 'number') : existing.stat_kick;
    const finalStatSpeed = isAdmin ? valOrExisting(stat_speed, existing.stat_speed, 'number') : existing.stat_speed;
    const finalStatTechnique = isAdmin ? valOrExisting(stat_technique, existing.stat_technique, 'number') : existing.stat_technique;
    const finalStatStamina = isAdmin ? valOrExisting(stat_stamina, existing.stat_stamina, 'number') : existing.stat_stamina;

    await db.query(`
      UPDATE users SET
        name = $1, email = $2, password_hash = $3, role = $4, jersey_number = $5, position = $6,
        dominant_foot = $7, birth_date = $8, height = $9, weight = $10, photo_url = $11,
        catchphrase = $12, reason_started = $13, hobby = $14, season_goal = $15, favorite_shoes = $16,
        salary = $17, stat_offense = $18, stat_defense = $19, stat_kick = $20, stat_speed = $21, stat_technique = $22, stat_stamina = $23, line_name = $24,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $25
    `, [
      name || existing.name, 
      email || existing.email, 
      passwordHash, 
      finalRole,
      valOrExisting(jersey_number, existing.jersey_number, 'number'),
      valOrExisting(position, existing.position),
      valOrExisting(dominant_foot, existing.dominant_foot),
      valOrExisting(birth_date, existing.birth_date, 'date'),
      valOrExisting(height, existing.height, 'number'),
      valOrExisting(weight, existing.weight, 'number'),
      valOrExisting(photo_url, existing.photo_url),
      valOrExisting(catchphrase, existing.catchphrase),
      valOrExisting(reason_started, existing.reason_started),
      valOrExisting(hobby, existing.hobby),
      valOrExisting(season_goal, existing.season_goal),
      valOrExisting(favorite_shoes, existing.favorite_shoes),
      finalSalary, finalStatOffense, finalStatDefense, finalStatKick, finalStatSpeed, finalStatTechnique, finalStatStamina,
      valOrExisting(line_name, existing.line_name),
      targetUserId
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
