import * as cheerio from 'cheerio';

export async function scrapeCups(targetMonth = null, targetDows = []) {
  try {
    // 正しい「名古屋駅前」の裏側URL（3014）に変更
    const baseTargetUrl = 'https://yoyaku.labola.jp/r/shop/3014/event/tournament/?embed=normal&category=futsal';
    const zenRowsApiKey = '1710b358a20644f03a1cc0b017e59ba81492686c';
    
    console.log(`Fetching multiple pages via ZenRows...`);
    const pages = [1, 2];
    const fetchPromises = pages.map(page => {
      const pageUrl = `${baseTargetUrl}&page=${page}`;
      const targetUrl = `https://api.zenrows.com/v1/?apikey=${zenRowsApiKey}&url=${encodeURIComponent(pageUrl)}&antibot=true&premium_proxy=true&js_render=true&wait=8000`;
      return fetch(targetUrl).then(r => r.text());
    });
    
    const htmls = await Promise.all(fetchPromises);
    const events = [];
    
    for (const html of htmls) {
      const $ = cheerio.load(html);
      $('.date').each((i, el) => {
        const dateText = $(el).text().trim();
        const titleText = $(el).next('h2').text().trim();
      
      if (dateText && titleText) {
        // e.g., "2026/06/30（火）21:00〜23:00｜フットサル大会"
        const match = dateText.match(/(\d{4})\/(\d{2})\/(\d{2})/);
        if (match) {
          const y = parseInt(match[1], 10);
          const m = parseInt(match[2], 10);
          const d = parseInt(match[3], 10);
          
          if (targetMonth && targetMonth !== m) {
            return; // skip this iteration
          }

          // 曜日の絞り込み
          if (targetDows && targetDows.length > 0) {
            const dateObj = new Date(y, m - 1, d);
            if (!targetDows.includes(dateObj.getDay())) {
              return; // skip
            }
          }
        }
        
        // フォーマット整形
        const cleanDate = dateText.split('｜')[0];
        events.push({
          dateText: cleanDate,
          title: titleText
        });
      }
      });
    }

    if (events.length > 0) {
      return { success: true, data: events };
    }
    
    console.log("Scraping returned no events or was blocked.");
    return { success: false, debugInfo: `Empty response or blocked.` };
  } catch (err) {
    console.error('Scrape Error:', err);
    return { success: false, debugInfo: `Exception: ${err.message}` };
  }
}
