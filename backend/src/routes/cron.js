import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// /api/cron/reminders
router.get('/reminders', async (req, res) => {
  // Simple auth for cron: Optional, Vercel sends an authorization header for crons
  
  try {
    const db = getDb();
    // 1. 過去データのクリーンアップ
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    try {
      const delRes = await db.query(`DELETE FROM events WHERE date_time < $1 AND event_type = 'match'`, [todayStr]);
      console.log(`Cleaned up ${delRes.rowCount} past events.`);
    } catch (e) {
      console.error('Cleanup error:', e);
    }

    // 2. 一週間前のリマインダー
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 7);
    const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const displayDate = `${targetDate.getMonth() + 1}月${targetDate.getDate()}日`;

    const eventsRes = await db.query(`
      SELECT event_id, title, date_time, location, description 
      FROM events 
      WHERE date_time LIKE $1 AND event_type = 'match'
    `, [`${targetDateStr}%`]);

    if (eventsRes.rows.length === 0) {
      return res.status(200).json({ message: 'No events found for reminder', targetDateStr });
    }

    const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN || "YomQr1v0D19HjVSmaIbPsnO4HOylAYo68w7EpsiM1mGIwJQIf2mZr+gy7zjGASYfa3nOtSHTXOECRv9FMdyejs8DlJl+FDDs3l5q75Yfa64ph7+Xupq5a3ofdsg4z/oJ5O/1sgUsgGLemz23LhO0cQdB04t89/1O/w1cDnyilFU=";
    if (!LINE_ACCESS_TOKEN) {
      return res.status(500).json({ error: 'No LINE token' });
    }

    const messages = [];

    for (const event of eventsRes.rows) {
      const loc = event.location || '未定';
      const time = event.description || '未定';
      const shortTitle = event.title.substring(0, 40).replace('【開催確定】', '[大会]');

      const attRes = await db.query(`
        SELECT u.name FROM attendances a
        JOIN users u ON a.user_id = u.user_id
        WHERE a.event_id = $1 AND a.status = 'present'
      `, [event.event_id]);
      
      const count = attRes.rows.length;
      const names = attRes.rows.map(r => r.name).join(', ');

      const bubble = {
        type: "bubble",
        body: {
          type: "box", layout: "vertical", spacing: "sm",
          contents: [
            { type: "text", text: `🔔 ${displayDate} 開催予定です！`, weight: "bold", size: "md", color: "#d21b1b" },
            { type: "text", text: "ほかに参加できる方はお願いします！\n", wrap: true },
            { type: "text", text: `【場所】${loc}\n【時間】${time}\n【現在の参加メンバー: ${count}名】\n${names}`, wrap: true, color: "#555555" }
          ]
        },
        footer: {
          type: "box", layout: "horizontal", spacing: "sm",
          contents: [
            {
              type: "button", style: "primary", height: "sm",
              action: { type: "postback", label: "参加", data: `action=attend&d=${event.date_time}&t=${shortTitle}&time=${time}`, displayText: `${displayDate}参加します` }
            },
            {
              type: "button", style: "secondary", height: "sm",
              action: { type: "postback", label: "不参加", data: `action=absent&d=${event.date_time}&t=${shortTitle}&time=${time}`, displayText: `${displayDate}不参加です` }
            }
          ]
        }
      };

      messages.push({
        type: "flex",
        altText: `${displayDate}のリマインダー`,
        contents: bubble
      });
    }

    // Send broadcast
    const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        messages: messages.slice(0, 5) // LINE allows max 5 messages per broadcast
      })
    });

    if (response.ok) {
      return res.status(200).json({ message: 'Broadcast successful', targetDateStr, events: eventsRes.rows.length });
    } else {
      const errText = await response.text();
      return res.status(500).json({ error: 'Broadcast failed', details: errText });
    }

  } catch (error) {
    console.error('Cron reminder error:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
