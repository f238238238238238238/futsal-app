import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// /api/cron/reminders
router.get('/reminders', async (req, res) => {
  // Simple auth for cron: Optional, Vercel sends an authorization header for crons
  
  try {
    const db = getDb();
    
    // Find events exactly 7 days from today
    // Date arithmetic in node
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 7);
    const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const eventsRes = await db.query(`
      SELECT event_id, title, date_time 
      FROM events 
      WHERE date_time LIKE $1 AND event_type = 'match' AND title LIKE '%【開催確定】%'
    `, [`${targetDateStr}%`]);

    if (eventsRes.rows.length === 0) {
      return res.status(200).json({ message: 'No events found for reminder', targetDateStr });
    }

    const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN || "YomQr1v0D19HjVSmaIbPsnO4HOylAYo68w7EpsiM1mGIwJQIf2mZr+gy7zjGASYfa3nOtSHTXOECRv9FMdyejs8DlJl+FDDs3l5q75Yfa64ph7+Xupq5a3ofdsg4z/oJ5O/1sgUsgGLemz23LhO0cQdB04t89/1O/w1cDnyilFU=";
    
    if (!LINE_ACCESS_TOKEN) {
      return res.status(500).json({ error: 'No LINE token' });
    }

    const messages = eventsRes.rows.map(event => {
      return {
        type: "text",
        text: `🔔 リマインダー\n来週（${targetDateStr}）の「${event.title}」の出欠が未入力の方は、早めに「参加する」か「参加不可」を登録してください！\n\n※このボットに「大会」と話しかけるとボタンが表示されます。`
      };
    });

    // Send broadcast
    const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        messages: messages
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
