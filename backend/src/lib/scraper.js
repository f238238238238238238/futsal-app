import * as cheerio from 'cheerio';

export async function scrapeCups(targetMonth = null, targetDows = []) {
  try {
    const targetUrl = encodeURIComponent('https://labola.jp/r/event/3014/tournament');
    const zenRowsApiKey = '1710b358a20644f03a1cc0b017e59ba81492686c';
    const zenRowsUrl = `https://api.zenrows.com/v1/?apikey=${zenRowsApiKey}&url=${targetUrl}`;
    
    console.log("Fetching from ZenRows API...");
    const res = await fetch(zenRowsUrl);
    const status = res.status;
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const events = [];
    
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

    if (events.length > 0) {
      return events;
    }
    
    console.log("Scraping returned no events or was blocked.");
    return [];
  } catch (err) {
    console.error('Scrape Error:', err);
    return [];
  }
}
