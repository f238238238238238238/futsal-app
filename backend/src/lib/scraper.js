import puppeteer from 'puppeteer';

export async function scrapeCups() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    // タイムアウトを30秒に設定
    await page.goto('https://labola.jp/r/event/3014/tournament', { waitUntil: 'networkidle2', timeout: 30000 });
    
    // イベントがレンダリングされるまで待機 (class名 .event-item などがある前提)
    // Labolaの場合は <div class="event-list-item"> や <ul> <li> に .title などがある
    // 念のため少し待つ
    await new Promise(resolve => setTimeout(resolve, 3000));

    const events = await page.evaluate(() => {
      const results = [];
      // LaBOLAのイベントリストは通常 .event-list 内の項目か、aタグの中
      const items = document.querySelectorAll('li.event-list-item, div.event-item, a[href*="/event/"]');
      
      items.forEach(el => {
        const textContent = el.innerText;
        // 日付や時間らしきものを抽出
        if (textContent.includes('月') && textContent.includes('日')) {
          results.push(textContent.trim().replace(/\n/g, ' '));
        }
      });
      return results;
    });
    
    return events;
  } catch (err) {
    console.error('Scrape Error:', err);
    return [];
  } finally {
    await browser.close();
  }
}
