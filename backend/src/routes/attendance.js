import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// POST /api/attendance/bulk
router.post('/bulk', async (req, res) => {
  const { lineUserId, lineDisplayName, attendances } = req.body;
  
  if (!lineUserId || !lineDisplayName || !Array.isArray(attendances)) {
    return res.status(400).json({ error: 'Invalid request data' });
  }

  const db = getDb();
  
  try {
    // 1. Fetch or auto-register user
    const userResult = await db.query('SELECT user_id, name, line_user_id FROM users WHERE line_user_id = $1 OR (line_user_id IS NULL AND (line_name = $2 OR name = $2))', [lineUserId, lineDisplayName]);
    let user = userResult.rows[0];

    if (user && !user.line_user_id) {
      await db.query('UPDATE users SET line_user_id = $1 WHERE user_id = $2', [lineUserId, user.user_id]);
    }

    if (!user) {
      const dummyEmail = `line_${lineUserId}@futsal.local`;
      const dummyHash = 'auto_created_no_password';
      const insertUserRes = await db.query(`
        INSERT INTO users (name, email, password_hash, role, line_user_id, line_name) 
        VALUES ($1, $2, $3, 'player', $4, $5) RETURNING user_id, name
      `, [lineDisplayName, dummyEmail, dummyHash, lineUserId, lineDisplayName]);
      user = insertUserRes.rows[0];
    }

    // 2. Process each attendance
    for (const item of attendances) {
      const { dateStr, shortTitle, timeStr, status } = item;
      if (!dateStr || !shortTitle || !status || status === 'pending') continue;

      // Find or create event
      // Because dateStr is stored in date_time and timeStr in description
      let eventRes;
      if (timeStr) {
        eventRes = await db.query('SELECT event_id, title, description FROM events WHERE date_time = $1 AND description = $2', [dateStr, timeStr]);
      } else {
        eventRes = await db.query('SELECT event_id, title, description FROM events WHERE date_time = $1 AND (description IS NULL OR description = \'\')', [dateStr]);
      }

      let eventId;
      if (eventRes.rows.length > 0) {
        eventId = eventRes.rows[0].event_id;
      } else {
        const insertRes = await db.query(
          "INSERT INTO events (title, event_type, date_time, location, description) VALUES ($1, 'match', $2, 'Z FUTSAL SPORT 名古屋駅前', $3) RETURNING event_id",
          [`[大会] ${shortTitle}`, dateStr, timeStr || '']
        );
        eventId = insertRes.rows[0].event_id;
      }

      // Check existing attendance
      const existingAtt = await db.query('SELECT attendance_id, status FROM attendances WHERE event_id = $1 AND user_id = $2', [eventId, user.user_id]);
      let previousStatus = null;

      if (existingAtt.rows.length > 0) {
        previousStatus = existingAtt.rows[0].status;
        if (previousStatus !== status) {
          await db.query('UPDATE attendances SET status = $1 WHERE attendance_id = $2', [status, existingAtt.rows[0].attendance_id]);
        }
      } else {
        await db.query('INSERT INTO attendances (event_id, user_id, status) VALUES ($1, $2, $3)', [eventId, user.user_id, status]);
      }

      // Check if threshold reached (only if moving to present)
      if (status === 'present' && previousStatus !== 'present') {
        const countRes = await db.query("SELECT COUNT(*) as cnt FROM attendances WHERE event_id = $1 AND status = 'present'", [eventId]);
        const count = parseInt(countRes.rows[0].cnt, 10);
        
        if (count === 7) {
          const ev = await db.query("SELECT title, date_time, location, description FROM events WHERE event_id = $1", [eventId]);
          const eData = ev.rows[0];
          
          const attendeesRes = await db.query(`
            SELECT u.name FROM attendances a 
            JOIN users u ON a.user_id = u.user_id 
            WHERE a.event_id = $1 AND a.status = 'present'
          `, [eventId]);
          const names = attendeesRes.rows.map(r => r.name).join(', ');

          await db.query("UPDATE events SET title = REPLACE(title, '[大会]', '【開催確定】[大会]') WHERE event_id = $1 AND title NOT LIKE '%【開催確定】%'", [eventId]);

          const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN || "YomQr1v0D19HjVSmaIbPsnO4HOylAYo68w7EpsiM1mGIwJQIf2mZr+gy7zjGASYfa3nOtSHTXOECRv9FMdyejs8DlJl+FDDs3l5q75Yfa64ph7+Xupq5a3ofdsg4z/oJ5O/1sgUsgGLemz23LhO0cQdB04t89/1O/w1cDnyilFU=";
          
          await fetch('https://api.line.me/v2/bot/message/broadcast', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
              messages: [{
                type: "text",
                text: `🎉 7人集まったため開催します！\n\n【日時】${eData.date_time} ${eData.description}\n【場所】${eData.location}\n【大会名】${eData.title.replace('【開催確定】', '')}\n\n現在の参加メンバー: \n${names}`
              }]
            })
          });
        }
      }
    }

    res.json({ success: true, user: { name: user.name } });
  } catch (error) {
    console.error('Bulk attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
