import * as cheerio from 'cheerio';
import fs from 'fs';

function testScraper() {
  const html = fs.readFileSync('labola.html', 'utf-8');
  const $ = cheerio.load(html);
  
  const results = [];
  
  $('.date').each((i, el) => {
    const dateText = $(el).text().trim();
    const titleText = $(el).next('h2').text().trim();
    
    // dateText: "2026/06/30（火）21:00〜23:00｜フットサル大会"
    if (dateText && titleText) {
      results.push({ date: dateText, title: titleText });
    }
  });
  
  console.log(results.slice(0, 5));
}
testScraper();
