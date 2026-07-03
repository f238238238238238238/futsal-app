const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

async function testProxy() {
  try {
    const proxies = await axios.get('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=elite');
    const proxyList = proxies.data.split('\r\n').filter(Boolean);
    console.log(`Found ${proxyList.length} proxies.`);
    
    for (let i = 0; i < Math.min(10, proxyList.length); i++) {
      const proxy = proxyList[i];
      console.log(`Trying proxy: ${proxy}`);
      try {
        const agent = new HttpsProxyAgent(`http://${proxy}`);
        const res = await axios.get('https://yoyaku.labola.jp/r/shop/3014/event/tournament/?embed=normal&category=futsal', {
          httpsAgent: agent,
          timeout: 5000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
        });
        if (res.status === 200 && res.data.includes('フットサル')) {
          console.log(`Success with proxy ${proxy}`);
          console.log(res.data.substring(0, 100));
          return;
        }
      } catch (err) {
        console.log(`Failed with proxy ${proxy}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error(err.message);
  }
}
testProxy();
