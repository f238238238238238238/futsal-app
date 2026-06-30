import { getDb } from './src/db/database.js';

// load .env
import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf-8');
envFile.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) process.env[k] = v.trim();
});

async function testLine() {
  const fetch = global.fetch;
  
  // mock req, res
  const req = {
    body: {
      events: [
        {
          type: 'message',
          replyToken: 'dummy_token',
          message: { type: 'text', text: '大会教えて' }
        }
      ]
    }
  };
  
  const res = {
    status: (s) => ({ send: (m) => console.log('res.status', s, m) })
  };
  
  const lineRouter = await import('./src/routes/line.js');
  // It's an Express router, we can't easily invoke it like a function
  // Let's just run the handleCupRequest logic
}
