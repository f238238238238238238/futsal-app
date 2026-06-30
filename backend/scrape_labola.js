import * as cheerio from 'cheerio';

async function scrapeLabola() {
  try {
    const res = await fetch('https://labola.jp/r/event/3014/tournament');
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const firstEvent = $('.event-list > li').first().html() || $('.event').first().html() || $('article').first().html() || $('.list-item').first().html() || $('li[class*="event"]').first().html() || $('ul.list > li').first().html();
    console.log('First event HTML:', firstEvent);
    
  } catch(e) {
    console.error(e);
  }
}
scrapeLabola();
