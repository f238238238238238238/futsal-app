import * as cheerio from 'cheerio';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function scrapeCups(targetMonth = null, targetDows = []) {
  try {
    const targetUrl = 'https://labola.jp/r/event/3014/tournament';
    console.log(`Fetching from ${targetUrl} using curl...`);
    
    // AWS WAF等のNode.js(fetch)に対するTLSフィンガープリント弾きを回避するため、
    // OSネイティブのcurlコマンドを使用してHTMLを取得します。
    const { stdout: html } = await execPromise(`curl -sL "${targetUrl}"`);
    
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
