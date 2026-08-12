const http = require('http');

const data = JSON.stringify({
  date: '2026-08-09',
  opponent_name: 'Test Team',
  competition_name: '',
  our_score: '5',
  opponent_score: '2',
  summary_text: '',
  mom_user_id: '',
  duration_seconds: 2400,
  video_url: '',
  stats: [],
  events: []
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/matches',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
