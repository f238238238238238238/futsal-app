import * as cheerio from 'cheerio';

export async function scrapeCups(targetMonth = null) {
  try {
    const res = await fetch('https://labola.jp/r/event/3014/tournament');
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
          const m = parseInt(match[2], 10);
          if (targetMonth && targetMonth !== m) {
            return; // skip this iteration
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

    return events;
  } catch (err) {
    console.error('Scrape Error:', err);
    return [];
  }
}
