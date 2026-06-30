import * as cheerio from 'cheerio';
async function test() {
  const res = await fetch('https://labola.jp/r/event/3014/tournament');
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const events = [];
  $('.event-search-list li').each((i, el) => {
    // try to guess labola structure
    events.push($(el).text().replace(/\s+/g, ' '));
  });
  console.log('Found with .event-search-list li:', events.length);
  
  if (events.length === 0) {
     $('.event-list a').each((i, el) => {
       events.push($(el).text().replace(/\s+/g, ' '));
     });
     console.log('Found with .event-list a:', events.length);
  }
  
  if (events.length === 0) {
      // Find elements containing '月' and '日'
      $('div, li, a').each((i, el) => {
          const t = $(el).text();
          if (t.includes('月') && t.includes('日') && t.includes('クラス')) {
             // console.log('Match:', t.substring(0, 100));
          }
      });
  }
  
  // Just print some classes
  console.log('Some classes:', $('body').html().substring(0, 500));
}
test();
