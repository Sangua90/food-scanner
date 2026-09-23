// Run: node tests/voice_frontend.cjs (requires playwright and Chromium).
// Exercises the active panel chain with keyboard dictation/text only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../custom_components/food_scanner/www');

(async () => {
  const server = http.createServer((req, res) => {
    const name = new URL(req.url, 'http://localhost').pathname;
    if (name === '/') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<script type="module" src="/food_scanner_static/panel_boot.js"></script>');
      return;
    }
    const file = path.join(root, path.basename(name));
    if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', 'text/javascript');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless: true, ...(process.env.BROWSER_CHANNEL ? {channel: process.env.BROWSER_CHANNEL} : {})});
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => customElements.get('food-scanner-panel')?.prototype.__homestock_frontend_build === '2.0.18');
    await page.evaluate(() => {
      window.requests = [];
      window.p = document.createElement('food-scanner-panel');
      p._hass = {callApi: async (method, url, data) => {
        requests.push({method, url, data});
        if (data?.action === 'preview') return {success: true, operations: [{id: 'pizza', status: 'matched', amount: 1}]};
        return {};
      }};
      document.body.appendChild(p);
      p.voiceOpen('food');
    });
    const shadow = selector => page.locator('food-scanner-panel').locator(selector);
    assert.equal(await shadow('#voiceRecordOptional1652').count(), 0);
    assert.equal(await shadow('#voiceText').count(), 1);
    await shadow('#voiceText').fill('una pizza');
    await shadow('#voiceGo').click();
    await page.waitForFunction(() => p._voice?.status === 'preview');
    const request = await page.evaluate(() => requests.at(-1));
    assert.equal(request.data.action, 'preview');
    assert.equal(request.data.text, 'una pizza');
    console.log('PASS keyboard dictation/text flow without direct recording');

    await page.evaluate(() => {
      p._hass.callApi = async () => ({
        success: false,
        code: 'voice_timeout',
        message: 'Tempo disponibile esaurito. Usa la dettatura della tastiera.'
      });
      p.voiceOpen('food');
      p.voiceAnalyzeText1651('pizza');
    });
    await page.waitForFunction(() => p._voice?.status === 'error');
    assert.match(await page.evaluate(() => p._voice.message), /Tempo disponibile esaurito/);
    console.log('PASS timeout stays inside the voice dialog');

    await page.evaluate(() => {
      p._hass.callApi = () => new Promise(resolve => {window.complete = resolve;});
      p.voiceOpen('food');
      p.voiceAnalyzeText1651('pizza');
      p.voiceClose();
      p.voiceOpen('cons');
      complete({success: true, operations: [{id: 'pizza', status: 'matched'}]});
    });
    await page.waitForTimeout(20);
    assert.deepEqual(await page.evaluate(() => ({status: p._voice.status, kind: p._voice.kind, ops: p._voice.ops})), {status: 'input', kind: 'cons', ops: []});
    console.log('PASS stale response cannot overwrite a new dialog');

    await page.evaluate(() => p.remove());
    assert.equal(await page.evaluate(() => p._voice), null);
    assert.deepEqual(errors, []);
    console.log('PASS leaving the panel clears the voice dialog without microphone state');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
