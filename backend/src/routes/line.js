import { Router } from 'express';
import { getDb } from '../db/database.js';
import { scrapeCups } from '../lib/scraper.js';

const router = Router();

// LINE Webhook Endpoint
router.post('/webhook', async (req, res) => {
  const events = req.body.events;
  if (!events || events.length === 0) {
    return res.status(200).send('OK');
  }

  for (const event of events) {
    try {
      if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text;
        // メンションされているか（mentioneesが存在するか）をチェック
        const hasMention = event.message.mention && event.message.mention.mentionees && event.message.mention.mentionees.length > 0;
        
        // 個人チャットかどうか
        const isPrivateChat = event.source.type === 'user';
        
        // 「〇月の大会」の〇を取り出す正規表現
        const monthMatch = text.match(/(\d+)月の?大会/);
        const targetMonth = monthMatch ? parseInt(monthMatch[1], 10) : null;

        // 「金土日」などの曜日指定を取り出す
        const dows = [];
        const dowStr = text.replace(/\d+月/, ''); // "7月"の"月"を誤検知させないため
        if (dowStr.match(/日曜|日のみ|日、|日と|金土日|土日|日祝|曜日/)) dows.push(0); 
        else if (dowStr.includes('日') && !dowStr.match(/\d+日/)) dows.push(0); // 〇日は除外
        
        if (dowStr.includes('月')) dows.push(1);
        if (dowStr.includes('火')) dows.push(2);
        if (dowStr.includes('水')) dows.push(3);
        if (dowStr.includes('木')) dows.push(4);
        if (dowStr.includes('金')) dows.push(5);
        if (dowStr.includes('土')) dows.push(6);

        // 「〇日は実施します」の〇を取り出す
        const holdMatch = text.match(/(\d+)日は実施します/);
        if (holdMatch) {
          await handleHoldEvent(event, holdMatch[1]);
          return;
        }
        
        // メンションがあるか、個人チャットの場合のみ反応する
        const shouldRespond = isPrivateChat || hasMention;
        
        if (shouldRespond) {
          if (text.includes('大会教えて') || text.includes('大会') || monthMatch || dows.length > 0) {
            await handleCupRequest(event, targetMonth, dows);
          }
        }
      } else if (event.type === 'postback') {
        // ボタンが押された場合 (action=attend&date=2026-07-10&title=...)
        await handlePostback(event);
      }
    } catch (err) {
      console.error('LINE Webhook Error:', err);
    }
  }

  // Vercel(Serverless)環境では、処理が全て終わってからレスポンスを返さないとプロセスが強制停止される
  res.status(200).send('OK');
});

async function handleHoldEvent(event, dayStr) {
  const replyToken = event.replyToken;
  const db = getDb();
  
  const paddedDay = dayStr.padStart(2, '0');
  // 日付文字列を検索 '%-15%' のような形
  const searchPattern = `%-${paddedDay}%`; 
  
  const evRes = await db.query("SELECT event_id, title FROM events WHERE date_time LIKE $1 ORDER BY date_time DESC LIMIT 1", [searchPattern]);
  if (evRes.rows.length > 0) {
    const eventId = evRes.rows[0].event_id;
    await db.query("UPDATE events SET is_held = true WHERE event_id = $1", [eventId]);
    await db.query("UPDATE attendances SET status = 'present' WHERE event_id = $1 AND status = 'pending'", [eventId]);
    await replyMessage(replyToken, { type: 'text', text: `${dayStr}日の「${evRes.rows[0].title}」への参加者を出席扱いに確定しました！出席王ランキングに反映されます👑` });
  } else {
    await replyMessage(replyToken, { type: 'text', text: `${dayStr}日に予定されている大会が見つかりませんでした。先に「参加する(〇)」を押してイベントを作成してください。` });
  }
}

async function handleCupRequest(event, targetMonth = null, targetDows = []) {
  const replyToken = event.replyToken;
  
  // 1. スクレイピング実行
  const cups = await scrapeCups(targetMonth, targetDows);
  
  if (!cups || cups.length === 0) {
    await replyMessage(replyToken, {
      type: 'text',
      text: '現在取得できる大会情報がありませんでした。'
    });
    return;
  }

  // 2. Flex Messageの構築
  // 取得したリストをフォーマットしてボタンを付ける
  const bubbles = cups.slice(0, 10).map((cup, i) => {
    // cup.dateText: "2026/06/30（火）21:00〜23:00"
    // cup.title: "満員御礼【特別☆ビギナークラス】..."
    const dMatch = cup.dateText.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    const dStr = dMatch ? `${dMatch[1]}-${dMatch[2]}-${dMatch[3]}` : `date_${i}`;
    
    // データ長制限のためタイトルは15文字程度に切り詰め
    const shortTitle = cup.title.substring(0, 15);
    
    return {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: cup.dateText,
            weight: "bold",
            color: "#1DB446",
            size: "sm"
          },
          {
            type: "text",
            text: cup.title,
            weight: "bold",
            size: "md",
            margin: "md",
            wrap: true
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            height: "sm",
            action: {
              type: "postback",
              label: "参加する(〇)",
              data: `action=attend&d=${dStr}&t=${encodeURIComponent(shortTitle)}`,
              displayText: "参加します"
            }
          }
        ],
        flex: 0
      }
    };
  });

  const flexMessage = {
    type: 'flex',
    altText: '大会情報',
    contents: {
      type: 'carousel',
      contents: bubbles
    }
  };

  await replyMessage(replyToken, flexMessage);
}

async function handlePostback(event) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');
  
  if (action === 'attend') {
    const profile = await getLineProfile(userId, event.source.groupId);
    if (!profile) {
      await replyMessage(replyToken, { type: 'text', text: 'LINEプロフィールの取得に失敗しました。' });
      return;
    }

    const lineName = profile.displayName;
    const db = getDb();
    
    const userResult = await db.query('SELECT user_id, name FROM users WHERE line_user_id = $1 OR (line_user_id IS NULL AND line_name = $2)', [userId, lineName]);
    const user = userResult.rows[0];

    if (!user) {
      await replyMessage(replyToken, {
        type: 'text',
        text: `LINE名「${lineName}」がサイトの選手名簿に登録されていません。サイトのユーザー設定からLINE名を登録してください。`
      });
      return;
    }

    const dateStr = data.get('d');
    const shortTitle = data.get('t');

    // イベントを探すか作成する
    let eventRes = await db.query('SELECT event_id FROM events WHERE date_time LIKE $1', [`${dateStr}%`]);
    let eventId;
    if (eventRes.rows.length > 0) {
      eventId = eventRes.rows[0].event_id;
    } else {
      const insertRes = await db.query(
        "INSERT INTO events (title, event_type, date_time, location, description) VALUES ($1, 'match', $2, 'Z FUTSAL SPORT 名古屋駅前', 'LINEからの自動登録') RETURNING event_id",
        [`[大会] ${shortTitle}...`, dateStr]
      );
      eventId = insertRes.rows[0].event_id;
    }

    // 出欠登録
    const attRes = await db.query('SELECT attendance_id FROM attendances WHERE event_id = $1 AND user_id = $2', [eventId, user.user_id]);
    if (attRes.rows.length === 0) {
      await db.query("INSERT INTO attendances (event_id, user_id, status) VALUES ($1, $2, 'present')", [eventId, user.user_id]);
    } else {
      await db.query("UPDATE attendances SET status = 'present' WHERE event_id = $1 AND user_id = $2", [eventId, user.user_id]);
    }

    // 現在の参加者一覧を取得
    const listRes = await db.query(`
      SELECT u.name FROM attendances a
      JOIN users u ON a.user_id = u.user_id
      WHERE a.event_id = $1 AND a.status = 'present'
    `, [eventId]);
    
    const count = listRes.rows.length;
    const names = listRes.rows.map(r => r.name).join(', ');

    let displayDate = dateStr;
    if (dateStr && dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length >= 3) {
        displayDate = `${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
      }
    }

    await replyMessage(replyToken, {
      type: 'text',
      text: `${displayDate}：${user.name}さんが「参加(〇)」として登録されました！\n\n【現在の参加予定者: ${count}名】\n${names}\n\n出欠管理画面にも反映されています。`
    });
  }
}

// ---------------- Helper Functions ----------------

async function replyMessage(replyToken, messageObj) {
  // 環境変数がVercelにうまく反映されないケースを防ぐため一時的にハードコード
  const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN || "YomQr1v0D19HjVSmaIbPsnO4HOylAYo68w7EpsiM1mGIwJQIf2mZr+gy7zjGASYfa3nOtSHTXOECRv9FMdyejs8DlJl+FDDs3l5q75Yfa64ph7+Xupq5a3ofdsg4z/oJ5O/1sgUsgGLemz23LhO0cQdB04t89/1O/w1cDnyilFU=";
  
  if (!LINE_ACCESS_TOKEN) {
    console.error('LINE_ACCESS_TOKEN is not set');
    return;
  }

  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [messageObj]
    })
  });
}

async function getLineProfile(userId, groupId = null) {
  const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN || "YomQr1v0D19HjVSmaIbPsnO4HOylAYo68w7EpsiM1mGIwJQIf2mZr+gy7zjGASYfa3nOtSHTXOECRv9FMdyejs8DlJl+FDDs3l5q75Yfa64ph7+Xupq5a3ofdsg4z/oJ5O/1sgUsgGLemz23LhO0cQdB04t89/1O/w1cDnyilFU=";
  if (!LINE_ACCESS_TOKEN) return null;

  try {
    let url = `https://api.line.me/v2/bot/profile/${userId}`;
    if (groupId) {
      url = `https://api.line.me/v2/bot/group/${groupId}/member/${userId}`;
    }

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
      }
    });

    if (res.ok) {
      return await res.json();
    } else {
      console.error('LINE profile error:', await res.text());
      return null;
    }
  } catch (err) {
    console.error('getLineProfile error:', err);
    return null;
  }
}

export default router;
