import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { countPlayerEvents, computeMatchRating } from '../lib/playerRatings.js';

const router = Router();

// イベントを時刻順に整列する。同一時刻は event_seq（なければ配列順）で順序を保証する
export function sortEventsChronologically(events) {
  return (events || [])
    .map((ev, i) => ({ ev, i }))
    .sort((a, b) =>
      ((a.ev.minute || 0) - (b.ev.minute || 0)) ||
      ((a.ev.event_seq ?? a.i) - (b.ev.event_seq ?? b.i))
    )
    .map(x => x.ev);
}

function parseLoc(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildEventInsert(matchId, events) {
  const values = [];
  const params = [];
  events.forEach((ev, i) => {
    const offset = i * 10;
    const isDummy = typeof ev.user_id === 'string' && (ev.user_id.startsWith('dummy_') || ev.user_id === 'opponent');
    let uid = isDummy ? null : ev.user_id;
    if (uid === '') uid = null;
    else if (uid != null) uid = parseInt(uid, 10);

    const pos = isDummy ? ev.user_id : (ev.position || null);

    let targetUid = null;
    if (ev.target_user_id && ev.target_user_id !== 'opponent' && ev.target_user_id !== '') {
      targetUid = parseInt(ev.target_user_id, 10);
    }

    values.push(`($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7}, $${offset+8}, $${offset+9}, $${offset+10})`);
    params.push(
      matchId, ev.event_type, uid, ev.minute ?? null, pos, targetUid,
      i, ev.period ?? null, parseLoc(ev.loc_x), parseLoc(ev.loc_y)
    );
  });
  return { values, params };
}

export function calculateMinutesPlayed(stats, events, matchLengthSeconds = 2400) {
  const playingTimesSecs = {};
  stats.forEach(st => playingTimesSecs[st.user_id] = 0);
  
  const enteredAt = {};
  stats.forEach(st => {
    if (st.is_starter) {
      enteredAt[st.user_id] = 0;
    }
  });

  const sortedEvents = sortEventsChronologically(events);

  // ピリオド（前後半）対応:
  // period_end でコート上の全員の時間を確定し、次の period_start で再開する。
  // 最初の period_start より前（ウォームアップ等）は出場時間に含めない。
  let pausedPlayers = null;
  let sawPeriodStart = false;

  sortedEvents.forEach(ev => {
    if (ev.event_type === 'sub_out') {
      if (enteredAt[ev.user_id] !== undefined) {
        playingTimesSecs[ev.user_id] = (playingTimesSecs[ev.user_id] || 0) + (ev.minute - enteredAt[ev.user_id]);
        delete enteredAt[ev.user_id];
      }
    } else if (ev.event_type === 'sub_in') {
      enteredAt[ev.user_id] = ev.minute;
    } else if (ev.event_type === 'substitution') {
      if (enteredAt[ev.target_user_id] !== undefined) {
        playingTimesSecs[ev.target_user_id] = (playingTimesSecs[ev.target_user_id] || 0) + (ev.minute - enteredAt[ev.target_user_id]);
        delete enteredAt[ev.target_user_id];
      }
      if (ev.user_id) {
        enteredAt[ev.user_id] = ev.minute;
      }
    } else if (ev.event_type === 'period_end') {
      pausedPlayers = Object.keys(enteredAt);
      pausedPlayers.forEach(uid => {
        playingTimesSecs[uid] = (playingTimesSecs[uid] || 0) + (ev.minute - enteredAt[uid]);
        delete enteredAt[uid];
      });
    } else if (ev.event_type === 'period_start') {
      if (pausedPlayers) {
        // ハーフタイム明け: コートにいたメンバーを再入場扱いにする
        pausedPlayers.forEach(uid => { enteredAt[uid] = ev.minute; });
        pausedPlayers = null;
      } else if (!sawPeriodStart) {
        // 試合開始: スタメンの入場時刻をキックオフに合わせる
        Object.keys(enteredAt).forEach(uid => { enteredAt[uid] = ev.minute; });
      }
      sawPeriodStart = true;
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

    // ゴール・アシスト・パスのイベント
    const eventsResult = await db.query(`
      SELECT me.*, u.name as user_name, tu.name as target_user_name
      FROM match_events me
      LEFT JOIN users u ON me.user_id = u.user_id
      LEFT JOIN users tu ON me.target_user_id = tu.user_id
      WHERE me.match_id = $1
      ORDER BY me.minute ASC, me.event_seq ASC NULLS LAST, me.event_id ASC
    `, [matchId]);

    res.json({
      ...match,
      stats: statsResult.rows.map(s => {
        const counts = countPlayerEvents(eventsResult.rows, s.user_id);
        if (parseInt(s.assists, 10) > 0) counts.assists = parseInt(s.assists, 10);
        if (parseInt(s.goals, 10) > 0) counts.goals = parseInt(s.goals, 10);
        return {
          ...s,
          rating: computeMatchRating(counts, s.minutes_played),
        };
      }),
      events: eventsResult.rows
    });
  } catch (err) {
    console.error('Get match error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// POST / - 試合登録（admin only）
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const db = getDb();
  let client;
  try {
    const { date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id, duration_seconds, video_url, stats, events } = req.body;
    const matchDur = duration_seconds ? parseInt(duration_seconds, 10) : 2400;

    if (!date || !opponent_name) {
      return res.status(400).json({ error: '日付と対戦相手は必須です' });
    }

    client = await db.connect();
    // トランザクションの開始
    await client.query('BEGIN');

    const matchRes = await client.query(`
      INSERT INTO matches (date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id, duration_seconds, video_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING match_id
    `, [
      date, 
      opponent_name, 
      competition_name, 
      our_score === '' || our_score == null ? 0 : parseInt(our_score, 10), 
      opponent_score === '' || opponent_score == null ? 0 : parseInt(opponent_score, 10), 
      summary_text, 
      mom_user_id || null, 
      matchDur, 
      video_url || null
    ]);
    
    const matchId = matchRes.rows[0].match_id;

    let playingTimes = {};
    if (stats && Array.isArray(stats)) {
      playingTimes = calculateMinutesPlayed(stats, events, matchDur);
      for (const st of stats) {
        const mins = playingTimes[st.user_id] || 0;
        await client.query(`
          INSERT INTO match_stats (match_id, user_id, is_starter, goals, assists, minutes_played, saves, position, sensor_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [matchId, st.user_id, st.is_starter ? 1 : 0, parseInt(st.goals,10) || 0, parseInt(st.assists,10) || 0, mins, parseInt(st.saves,10) || 0, st.position || null, st.sensor_id || null]);
      }
    }

    if (events && Array.isArray(events) && events.length > 0) {
      const { values, params } = buildEventInsert(matchId, events);
      await client.query(`
        INSERT INTO match_events (match_id, event_type, user_id, minute, position, target_user_id, event_seq, period, loc_x, loc_y)
        VALUES ${values.join(', ')}
      `, params);
    }

    await client.query('COMMIT');
    res.status(201).json({ match_id: matchId, message: '試合を登録しました' });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Create match error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました', details: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// PUT /:id - 試合更新（admin only）
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const db = getDb();
  let client;
  try {
    const matchId = req.params.id;
    const { date, opponent_name, competition_name, our_score, opponent_score, summary_text, mom_user_id, duration_seconds, video_url, stats, events } = req.body;
    const matchDur = duration_seconds ? parseInt(duration_seconds, 10) : 2400;

    if (!date || !opponent_name) {
      return res.status(400).json({ error: '日付と対戦相手は必須です' });
    }

    client = await db.connect();
    await client.query('BEGIN');

    await client.query(`
      UPDATE matches
      SET date = $1, opponent_name = $2, competition_name = $3, our_score = $4, opponent_score = $5, summary_text = $6, mom_user_id = $7, duration_seconds = $8, video_url = $9
      WHERE match_id = $10
    `, [
      date, 
      opponent_name, 
      competition_name, 
      our_score === '' || our_score == null ? 0 : parseInt(our_score, 10), 
      opponent_score === '' || opponent_score == null ? 0 : parseInt(opponent_score, 10), 
      summary_text, 
      mom_user_id || null, 
      matchDur, 
      video_url || null, 
      matchId
    ]);

    // Update stats: delete old and insert new
    await client.query(`DELETE FROM match_stats WHERE match_id = $1`, [matchId]);
    let playingTimes = {};
    if (stats && Array.isArray(stats)) {
      playingTimes = calculateMinutesPlayed(stats, events, matchDur);
      for (const st of stats) {
        const mins = playingTimes[st.user_id] || 0;
        await client.query(`
          INSERT INTO match_stats (match_id, user_id, is_starter, goals, assists, minutes_played, saves, position, sensor_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [matchId, st.user_id, st.is_starter ? 1 : 0, parseInt(st.goals,10) || 0, parseInt(st.assists,10) || 0, mins, parseInt(st.saves,10) || 0, st.position || null, st.sensor_id || null]);
      }
    }

    // Update events: delete old and insert new
    await client.query(`DELETE FROM match_events WHERE match_id = $1`, [matchId]);
    if (events && Array.isArray(events) && events.length > 0) {
      const { values, params } = buildEventInsert(matchId, events);
      await client.query(`
        INSERT INTO match_events (match_id, event_type, user_id, minute, position, target_user_id, event_seq, period, loc_x, loc_y)
        VALUES ${values.join(', ')}
      `, params);
    }

    await client.query('COMMIT');
    res.json({ message: '試合を更新しました' });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Update match error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました', details: err.message });
  } finally {
    if (client) {
      client.release();
    }
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
