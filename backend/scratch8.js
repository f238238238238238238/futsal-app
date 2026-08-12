async function run() {
  const payload = {
    date: '2026-07-26',
    opponent_name: 'Test',
    competition_name: 'Test',
    our_score: 0,
    opponent_score: 1,
    stats: [
      { user_id: '1', is_starter: 1, position: 'Fixo', goals: 0, assists: 0, saves: 0 }
    ],
    events: [
      { event_type: 'pass_cut', user_id: '1', minute: 10 },
      { event_type: 'steal', user_id: '1', minute: 10 }
    ]
  };

  const res = await fetch('https://futsal-frontend-ten.vercel.app/api/matches', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Admin cookie or token?
      // Wait, is there auth required?
    },
    body: JSON.stringify(payload)
  });
  
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text);
}
run();
