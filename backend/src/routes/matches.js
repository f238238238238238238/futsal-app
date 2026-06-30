import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

function calculateMinutesPlayed(stats, events, matchLengthSeconds = 2400) {
  const playingTimesSecs = {};
  stats.forEach(st => playingTimesSecs[st.user_id] = 0);
  
  const enteredAt = {};
  stats.forEach(st => {
    if (st.is_starter) {
      enteredAt[st.user_id] = 0;
    }
  });

  const sortedEvents = [...(events || [])].sort((a,b) => (a.minute || 0) - (b.minute || 0));

  sortedEvents.forEach(ev => {
    if (ev.event_type === 'sub_out') {
      if (enteredAt[ev.user_id] !== undefined) {
        playingTimesSecs[ev.user_id] = (playingTimesSecs[ev.user_id] || 0) + (ev.minute - enteredAt[ev.user_id]);
        delete enteredAt[ev.user_id];
      }
    } else if (ev.event_type === 'sub_in') {
      enteredAt[ev.user_id] = ev.minute;
    }
  });

  Object.keys(enteredAt).forEach(userId => {
    playingTimesSecs[userId] = (playingTimesSecs[userId] || 0) + (matchLengthSeconds - enteredAt[userId]);
  });

  const playingTimesMins = {};
  Object.keys(playingTimesSecs).forEach(k => {
    playingTimesMins[k] = Math.round(playingTimesSecs[k] / 60);
  });
  return playingTimesMins;
}

// GET / - 試合一覧
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { year } = req.query;

    let query = 'SELECT * FROM matches';
    const params = [];

    if (year && year !== 'all') {
      query += ' WHERE EXTRACT(YEAR FROM date::date) = $1';
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
      SELECT ms.*, u.name as user_name, u.jersey_number, u.photo_url
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
    const { date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id, duration_seconds, stats, events } = req.body;
    const matchDur = duration_seconds ? parseInt(duration_seconds, 10) : 2400;

    if (!date || !opponent_name) {
      return res.status(400).json({ error: '日付と対戦相手は必須です' });
    }

    // トランザクションの開始
    await db.query('BEGIN');

    const matchRes = await db.query(`
      INSERT INTO matches (date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id, duration_seconds)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING match_id
    `, [date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id || null, matchDur]);
    
    const matchId = matchRes.rows[0].match_id;

    let playingTimes = {};
    if (stats && Array.isArray(stats)) {
      playingTimes = calculateMinutesPlayed(stats, events, matchDur);
      for (const st of stats) {
        const mins = playingTimes[st.user_id] || 0;
        await db.query(`
          INSERT INTO match_stats (match_id, user_id, is_starter, goals, assists, minutes_played, saves, position)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [matchId, st.user_id, st.is_starter ? 1 : 0, parseInt(st.goals,10) || 0, parseInt(st.assists,10) || 0, mins, parseInt(st.saves,10) || 0, st.position || null]);
      }
    }

    if (events && Array.isArray(events)) {
      for (const ev of events) {
        await db.query(`
          INSERT INTO match_events (match_id, event_type, user_id, minute, position)
          VALUES ($1, $2, $3, $4, $5)
        `, [matchId, ev.event_type, ev.user_id, ev.minute || null, ev.position || null]);
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
    const { date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id, duration_seconds, stats, events } = req.body;
    const matchDur = duration_seconds ? parseInt(duration_seconds, 10) : 2400;

    if (!date || !opponent_name) {
      return res.status(400).json({ error: '日付と対戦相手は必須です' });
    }

    await db.query('BEGIN');

    await db.query(`
      UPDATE matches
      SET date = $1, opponent_name = $2, competition_name = $3, our_score = $4, opponent_score = $5, summary_text = $6, mom_user_id = $7, duration_seconds = $8
      WHERE match_id = $9
    `, [date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id || null, matchDur, matchId]);

    // Update stats: delete old and insert new
    await db.query(`DELETE FROM match_stats WHERE match_id = $1`, [matchId]);
    let playingTimes = {};
    if (stats && Array.isArray(stats)) {
      playingTimes = calculateMinutesPlayed(stats, events, matchDur);
      for (const st of stats) {
        const mins = playingTimes[st.user_id] || 0;
        await db.query(`
          INSERT INTO match_stats (match_id, user_id, is_starter, goals, assists, minutes_played, saves, position)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [matchId, st.user_id, st.is_starter ? 1 : 0, parseInt(st.goals,10) || 0, parseInt(st.assists,10) || 0, mins, parseInt(st.saves,10) || 0, st.position || null]);
      }
    }

    // Update events: delete old and insert new
    await db.query(`DELETE FROM match_events WHERE match_id = $1`, [matchId]);
    if (events && Array.isArray(events)) {
      for (const ev of events) {
        await db.query(`
          INSERT INTO match_events (match_id, event_type, user_id, minute, position)
          VALUES ($1, $2, $3, $4, $5)
        `, [matchId, ev.event_type, ev.user_id, ev.minute || null, ev.position || null]);
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
