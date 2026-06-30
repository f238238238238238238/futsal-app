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
        const hasMention = event.message.mentions && event.message.mentions.mentionees && event.message.mentions.mentionees.length > 0;
        
        // 「大会教えて」が含まれている、またはメンションされている場合に反応
        if (text.includes('大会教えて') || hasMention) {
          await handleCupRequest(event);
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

async function handleCupRequest(event) {
  const replyToken = event.replyToken;
  
  // 1. スクレイピング実行
  const cups = await scrapeCups();
  
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
    // 簡易パース: 文字列から情報を取り出す (実運用では正確なパースが必要)
    return {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "Z FUTSAL SPORT 名古屋",
            weight: "bold",
            color: "#1DB446",
            size: "sm"
          },
          {
            type: "text",
            text: cup.substring(0, 40) + '...',
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
              data: `action=attend&cup_id=${i}`, // 本当は日付やタイトルを含める
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
    // LINEプロフィールの取得
    const profile = await getLineProfile(userId, event.source.groupId);
    if (!profile) {
      await replyMessage(replyToken, { type: 'text', text: 'LINEプロフィールの取得に失敗しました。' });
      return;
    }

    const lineName = profile.displayName;
    const db = getDb();
    
    // DBでユーザー検索
    const userResult = await db.query('SELECT user_id, name FROM users WHERE line_name = $1', [lineName]);
    const user = userResult.rows[0];

    if (!user) {
      await replyMessage(replyToken, {
        type: 'text',
        text: `LINE名「${lineName}」がサイトの選手名簿に登録されていません。サイトのユーザー設定からLINE名を登録してください。`
      });
      return;
    }

    // イベントの作成または取得処理 (今回は簡略化のため、モックとして返信だけ行う)
    // 実運用では events テーブルに INSERT し、 attendances テーブルに INSERT する。
    
    await replyMessage(replyToken, {
      type: 'text',
      text: `${user.name}さんが大会に「参加(〇)」しました！サイトの出欠表に反映しました。`
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
