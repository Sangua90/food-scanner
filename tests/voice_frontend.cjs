// Run: node tests/voice_frontend.cjs (requires playwright and Chromium).
// Loads the COMPLETE active module chain and exercises real DOM event binding.
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
    browser = await chromium.launch({headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'], ...(process.env.BROWSER_CHANNEL ? {channel: process.env.BROWSER_CHANNEL} : {})});
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => customElements.get('food-scanner-panel')?.prototype.__homestock_frontend_build === '2.0.17');
    await page.evaluate(() => {
      window.requests = [];
      window.nativeRecorder = window.MediaRecorder;
      window.nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      window.stopped = 0;
      window.p = document.createElement('food-scanner-panel');
      p._hass = {callApi: async (method, url, data) => {
        requests.push({method, url, data});
        if(data?.action === 'transcribe') return {success: true, text: 'una pizza'};
        if(data?.action === 'preview') return {success: true, operations: [{id: 'pizza', status: 'matched', amount: 1}]};
        return {};
      }};
      document.body.appendChild(p);
      window.stream = () => ({getTracks: () => [{stop() {stopped++;}}]});
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {configurable: true, value: async () => stream()});
      window.audioMime = 'audio/mp4';
      window.MediaRecorder = class {
        static isTypeSupported(type) {return type === audioMime;}
        constructor(stream, options) {this.mimeType = options?.mimeType || audioMime; this.state = 'inactive';}
        start() {this.state = 'recording';}
        stop() {
          this.state = 'inactive';
          queueMicrotask(() => {
            this.ondataavailable?.({data: new Blob(['audio-test'], {type: this.mimeType})});
            this.onstop?.();
          });
        }
      };
      p.voiceOpen('food');
    });
    const shadow = selector => page.locator('food-scanner-panel').locator(selector);
    for (const mime of ['audio/mp4', 'audio/webm;codecs=opus']) {
      await page.evaluate(mime => {audioMime = mime; p.voiceOpen('food');}, mime);
      await shadow('#voiceRecordOptional1652').click();
      await shadow('#voiceStop1651').click();
      await page.waitForFunction(() => p._voice?.status === 'preview');
      const request = await page.evaluate(() => requests.filter(r => r.data?.action === 'transcribe').at(-1));
      assert.equal(request.data.mime_type, mime.split(';')[0]);
      assert.equal(Buffer.from(request.data.audio_data, 'base64').toString(), 'audio-test');
      assert.equal(request.data.action, 'transcribe');
    }
    console.log('PASS full active chain: Registra vocale -> MP4/WebM -> transcribe -> preview');

    await page.evaluate(() => {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {value: async () => {throw new DOMException('denied', 'NotAllowedError');}});
      p.voiceOpen('cons');
    });
    await shadow('#voiceRecordOptional1652').click();
    await page.waitForFunction(() => p._voice?.status === 'mic_error');
    await shadow('#voiceUseKeyboard1651').click();
    assert.equal(await page.evaluate(() => p._voice.status), 'input');
    console.log('PASS denied permission: usable keyboard fallback');

    await page.evaluate(() => {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {value: () => new Promise(resolve => {window.allow = resolve;})});
      p.voiceOpen('food');
    });
    await shadow('#voiceRecordOptional1652').click();
    await shadow('#voiceX').click();
    await page.evaluate(() => {p.voiceOpen('cons'); allow(stream());});
    await page.waitForTimeout(20);
    assert.deepEqual(await page.evaluate(() => ({kind: p._voice.kind, status: p._voice.status, recorder: !!p._voiceRecorder1651})), {kind: 'cons', status: 'input', recorder: false});
    console.log('PASS late microphone permission cannot capture into a reopened popup');

    await page.evaluate(() => {
      window.originalTimeout = window.setTimeout;
      window.setTimeout = (fn, delay, ...args) => originalTimeout(fn, [15000, 25000, 45000, 5000].includes(delay) ? 40 : delay, ...args);
      p.voiceOpen('food');
    });
    await shadow('#voiceRecordOptional1652').click();
    await page.waitForFunction(() => p._voice?.status === 'mic_error');
    assert.match(await page.evaluate(() => p._voice.message), /Nessuna risposta/);
    console.log('PASS ignored microphone permission expires to fallback');

    await page.evaluate(() => {
      p._hass.callApi = () => new Promise(() => {});
      p.voiceOpen('food');
      p.voiceAnalyzeText1651('pizza');
    });
    await page.waitForFunction(() => p._voice?.status === 'error');
    assert.match(await page.evaluate(() => p._voice.message), /non risponde/);
    console.log('PASS stalled HTTP returns to editable text');

    await page.evaluate(() => {
      window.setTimeout = originalTimeout;
      p._hass.callApi = () => new Promise(resolve => {window.complete = resolve;});
      p.voiceOpen('food');
      p.voiceAnalyzeText1651('pizza');
      p.voiceClose();
      p.voiceOpen('cons');
      complete({operations: [{id: 'pizza', status: 'matched'}]});
    });
    await page.waitForTimeout(20);
    assert.deepEqual(await page.evaluate(() => ({status: p._voice.status, kind: p._voice.kind, ops: p._voice.ops})), {status: 'input', kind: 'cons', ops: []});
    console.log('PASS stale response does not overwrite a new voice session');

    await page.evaluate(() => {
      MediaRecorder = nativeRecorder;
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {value: nativeGetUserMedia});
      p._hass.callApi = async (method, url, data) => {
        requests.push({method, url, data});
        return data.action === 'transcribe' ? {text: 'pizza'} : {operations: [{id: 'pizza', status: 'matched', amount: 1}]};
      };
      p.voiceOpen('food');
    });
    await shadow('#voiceRecordOptional1652').click();
    await page.waitForFunction(() => p._voice?.status === 'recording');
    await page.waitForTimeout(350);
    await shadow('#voiceStop1651').click();
    await page.waitForFunction(() => p._voice?.status === 'preview');
    const realAudio = await page.evaluate(() => requests.filter(r => r.data?.action === 'transcribe').at(-1).data);
    assert.ok(['audio/mp4', 'audio/webm', 'audio/ogg'].includes(realAudio.mime_type));
    assert.ok(Buffer.from(realAudio.audio_data, 'base64').length > 100);
    console.log(`PASS native browser MediaRecorder with synthetic microphone: ${realAudio.mime_type}`);
    await page.evaluate(() => p.voiceOpen('food'));
    await shadow('#voiceRecordOptional1652').click();
    await page.waitForFunction(() => p._voice?.status === 'recording');
    await page.evaluate(() => {window.track = p._voiceStream1651.getTracks()[0]; p.remove();});
    assert.equal(await page.evaluate(() => track.readyState), 'ended');
    assert.equal(await page.evaluate(() => p._voice), null);
    console.log('PASS leaving the panel releases the native microphone');
    assert.deepEqual(errors, []);
    console.log('PASS no browser JavaScript errors');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
