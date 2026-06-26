import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET / - 試合一覧
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { year } = req.query;

    let query = 'SELECT * FROM matches';
    const params = [];

    if (year && year !== 'all') {
      query += ' WHERE EXTRACT(YEAR FROM date) = $1';
      params.push(parseInt(year, 10));
    }

    query += ' ORDER BY date DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get matches error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// GET /:id - 試合詳細
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const matchId = req.params.id;

    // 基本情報 + MOMの名前
    const matchResult = await db.query(`
      SELECT m.*, u.name as mom_name
      FROM matches m
      LEFT JOIN users u ON m.mom_user_id = u.user_id
      WHERE m.match_id = $1
    `, [matchId]);
    const match = matchResult.rows[0];

    if (!match) {
      return res.status(404).json({ error: '試合が見つかりません' });
    }

    // 出場メンバーの成績
    const statsResult = await db.query(`
      SELECT ms.*, u.name as user_name, u.jersey_number
      FROM match_stats ms
      JOIN users u ON ms.user_id = u.user_id
      WHERE ms.match_id = $1
    `, [matchId]);

    // ゴール・アシストのイベント
    const eventsResult = await db.query(`
      SELECT me.*, u.name as user_name
      FROM match_events me
      JOIN users u ON me.user_id = u.user_id
      WHERE me.match_id = $1
      ORDER BY me.minute ASC
    `, [matchId]);

    res.json({
      ...match,
      stats: statsResult.rows,
      events: eventsResult.rows
    });
  } catch (err) {
    console.error('Get match error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// POST / - 試合登録（admin only）
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id, stats, events } = req.body;

    if (!date || !opponent_name) {
      return res.status(400).json({ error: '日付と対戦相手は必須です' });
    }

    // トランザクションの開始
    await db.query('BEGIN');

    const matchRes = await db.query(`
      INSERT INTO matches (date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING match_id
    `, [date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id || null]);
    
    const matchId = matchRes.rows[0].match_id;

    if (stats && Array.isArray(stats)) {
      for (const st of stats) {
        await db.query(`
          INSERT INTO match_stats (match_id, user_id, is_starter, goals, assists, minutes_played)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [matchId, st.user_id, st.is_starter ? 1 : 0, parseInt(st.goals,10) || 0, parseInt(st.assists,10) || 0, parseInt(st.minutes_played,10) || 0]);
      }
    }

    if (events && Array.isArray(events)) {
      for (const ev of events) {
        await db.query(`
          INSERT INTO match_events (match_id, event_type, user_id, minute)
          VALUES ($1, $2, $3, $4)
        `, [matchId, ev.event_type, ev.user_id, ev.minute || null]);
      }
    }

    await db.query('COMMIT');
    res.status(201).json({ match_id: matchId, message: '試合を登録しました' });
  } catch (err) {
    const db = getDb();
    await db.query('ROLLBACK');
    console.error('Create match error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// PUT /:id - 試合更新（admin only）
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const matchId = req.params.id;
    const { date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id, stats, events } = req.body;

    if (!date || !opponent_name) {
      return res.status(400).json({ error: '日付と対戦相手は必須です' });
    }

    await db.query('BEGIN');

    await db.query(`
      UPDATE matches
      SET date = $1, opponent_name = $2, competition_name = $3, our_score = $4, opponent_score = $5, summary_text = $6, mom_user_id = $7
      WHERE match_id = $8
    `, [date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id || null, matchId]);

    // Update stats: delete old and insert new
    await db.query(`DELETE FROM match_stats WHERE match_id = $1`, [matchId]);
    if (stats && Array.isArray(stats)) {
      for (const st of stats) {
        await db.query(`
          INSERT INTO match_stats (match_id, user_id, is_starter, goals, assists, minutes_played)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [matchId, st.user_id, st.is_starter ? 1 : 0, parseInt(st.goals,10) || 0, parseInt(st.assists,10) || 0, parseInt(st.minutes_played,10) || 0]);
      }
    }

    // Update events: delete old and insert new
    await db.query(`DELETE FROM match_events WHERE match_id = $1`, [matchId]);
    if (events && Array.isArray(events)) {
      for (const ev of events) {
        await db.query(`
          INSERT INTO match_events (match_id, event_type, user_id, minute)
          VALUES ($1, $2, $3, $4)
        `, [matchId, ev.event_type, ev.user_id, ev.minute || null]);
      }
    }

    await db.query('COMMIT');
    res.json({ message: '試合を更新しました' });
  } catch (err) {
    const db = getDb();
    await db.query('ROLLBACK');
    console.error('Update match error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// DELETE /:id - 試合削除（admin only）
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const matchId = req.params.id;
    // DELETE CASCADE will handle stats and events automatically based on our migration
    await db.query('DELETE FROM matches WHERE match_id = $1', [matchId]);
    res.json({ message: '試合を削除しました' });
  } catch (err) {
    console.error('Delete match error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

export default router;
