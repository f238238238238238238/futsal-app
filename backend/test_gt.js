import * as cheerio from 'cheerio';
fetch('https://translate.google.com/translate?sl=ja&tl=ja&u=' + encodeURIComponent('https://yoyaku.labola.jp/r/shop/3014/event/tournament/?embed=normal&category=futsal')).then(r=>r.text()).then(t=>{ const $ = cheerio.load(t); console.log('Found:', $('.date').length); })
