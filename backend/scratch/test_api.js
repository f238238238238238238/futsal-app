async function fetchLabola() {
  const url = 'https://labola.jp/api/r/shop/3014/events?category=tournament';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log(JSON.stringify(data).substring(0, 500));
  } catch (e) {
    console.error('API 1 failed', e);
  }
}
fetchLabola();
