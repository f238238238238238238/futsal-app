import * as cheerio from 'cheerio';

export async function scrapeCups(targetMonth = null, targetDows = []) {
  try {
    const baseTargetUrl = 'https://yoyaku.labola.jp/r/shop/3014/event/tournament/?embed=normal&category=futsal';
    const scraperApiKey = process.env.SCRAPER_API_KEY || 'c49ad1f5f652264dc835066a9da33872';
    console.log(`Fetching multiple pages via ScraperAPI (premium mode)...`);
    const pages = [1, 2];
    const fetchPromises = pages.map(page => {
      const pageUrl = `${baseTargetUrl}&page=${page}`;
      // Add render=true to bypass advanced WAF by executing JS
      const targetUrl = `http://api.scraperapi.com/?api_key=${scraperApiKey}&render=true&url=${encodeURIComponent(pageUrl)}`;
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

    // Check if the page actually loaded correctly by looking for typical LaBOLA elements
    const isBlocked = htmls.some(html => html.includes('awsWafCookie') || html.includes('captcha') || html.includes('Access Denied'));
    
    if (isBlocked) {
      console.log("Scraping returned no events because it was blocked by WAF.");
      return { success: false, debugInfo: `Blocked by WAF.` };
    }

    return { success: true, data: events };
  } catch (err) {
    console.error('Scrape Error:', err);
    return { success: false, debugInfo: `Exception: ${err.message}` };
  }
}
