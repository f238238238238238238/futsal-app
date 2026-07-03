import * as cheerio from 'cheerio';

export async function scrapeCups(targetMonth = null, targetDows = []) {
  try {
    const baseTargetUrl = 'https://yoyaku.labola.jp/r/shop/3014/event/tournament/?embed=normal&category=futsal';
    console.log(`Fetching multiple pages directly...`);
    const pages = [1, 2];
    const fetchPromises = pages.map(page => {
      const pageUrl = `${baseTargetUrl}&page=${page}`;
      return fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }).then(r => r.text());
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
        let isoDate = null;
        if (match) {
          const y = parseInt(match[1], 10);
          const m = parseInt(match[2], 10);
          const d = parseInt(match[3], 10);
          isoDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          
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
        
        let availability = "情報なし";
        const parentText = $(el).parent().text() || "";
        const parentHtml = $(el).parent().html() || "";
        if (parentHtml.includes('受付終了') || parentText.includes('受付終了')) availability = '受付終了';
        else if (parentHtml.includes('キャンセル待ち') || parentText.includes('キャンセル待ち')) availability = 'キャンセル待ち';
        else if (parentHtml.includes('残りわずか') || parentText.includes('残りわずか') || parentHtml.includes('△')) availability = '残りわずか';
        else if (parentHtml.includes('空き') || parentText.includes('空き') || parentHtml.includes('〇') || parentHtml.includes('◎')) availability = '空きあり';

        // フォーマット整形
        const cleanDate = dateText.split('｜')[0];
        events.push({
          dateText: cleanDate,
          title: titleText,
          isoDate,
          availability
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
