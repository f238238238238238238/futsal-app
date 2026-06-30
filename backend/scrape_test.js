import * as cheerio from 'cheerio';

async function scrape() {
  try {
    const res = await fetch('https://zfutsal.com/nagoya/cup/');
    const html = await res.text();
    const $ = cheerio.load(html);
    
    // Z futsal sport uses an iframe from labola usually. Let's find it.
    const iframes = $('iframe').map((i, el) => $(el).attr('src')).get();
    console.log('Iframes:', iframes);
    
    // Look for any links with "labola"
    const labolaLinks = $('a[href*="labola"]').map((i, el) => $(el).attr('href')).get();
    console.log('Labola Links:', labolaLinks.slice(0, 5));
    
  } catch(e) {
    console.error(e);
  }
}
scrape();
