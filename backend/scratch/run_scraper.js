import { scrapeCups } from '../src/lib/scraper.js';

scrapeCups().then(res => {
  if (res && res.data) {
    console.log(JSON.stringify(res.data, null, 2));
  } else {
    console.log(res);
  }
});
