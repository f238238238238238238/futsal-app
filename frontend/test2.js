const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:3000/admin/matches/live', {waitUntil: 'networkidle0'});
  
  // mock courtIds and start match
  await page.evaluate(() => {
     window.__NEXT_DATA__.props.pageProps = {}; // ignore
  });
  // Since we can't easily click, let's just trigger a click on the 'Start' if we can bypass alert
  // Actually we can just select 5 players
  const benchPlayers = await page.$$('[class*="playerCard"]');
  const pitchSlots = await page.$$('[class*="pitchSlotEmpty"]');
  
  for(let i=0; i<5; i++) {
     if(benchPlayers[i] && pitchSlots[i]) {
        await pitchSlots[i].click(); // select pos
        await benchPlayers[i].click(); // select player
     }
  }

  // Click Start Match
  const [startBtn] = await page.$x("//button[contains(., '試合開始')]");
  if (startBtn) {
    await startBtn.click();
    console.log('Clicked Start Match');
  } else {
    console.log('Start match button not found');
  }

  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
