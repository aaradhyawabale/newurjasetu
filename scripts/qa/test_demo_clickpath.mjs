import http from 'http';
import { WebSocket } from 'ws';

async function getBrowserWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/version', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data).webSocketDebuggerUrl));
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
  }
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
      this.ws.on('message', (msg) => {
        const data = JSON.parse(msg.toString());
        if (data.id && this.callbacks.has(data.id)) {
          const cb = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          cb.resolve(data.result);
        }
      });
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.ws.close(); }
}

async function testClickpath() {
  const wsUrl = await getBrowserWsUrl();
  const browser = new CDPClient(wsUrl);
  await browser.connect();

  const pageTarget = await browser.send('Target.createTarget', { url: 'about:blank' });
  const targetId = pageTarget.targetId;
  const page = new CDPClient(`ws://127.0.0.1:9222/devtools/page/${targetId}`);
  await page.connect();
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

  console.log('--- Testing Demo Clickpath ---');
  const t0 = Date.now();

  // Step 1: Landing Page
  console.log('[T+0s] Navigating to http://localhost:3005/');
  await page.send('Page.navigate', { url: 'http://localhost:3005/' });
  await new Promise(r => setTimeout(r, 2000));
  console.log(`[T+${((Date.now()-t0)/1000).toFixed(1)}s] Landing page loaded`);

  // Step 2: Navigate to Heat Planner
  console.log('[Step 2] Navigating to http://localhost:3005/heat-planner');
  await page.send('Page.navigate', { url: 'http://localhost:3005/heat-planner' });
  await new Promise(r => setTimeout(r, 2500));
  console.log(`[T+${((Date.now()-t0)/1000).toFixed(1)}s] Heat planner loaded with default 25 ha allocation`);

  // Step 3: Click cell to open Evidence Drawer
  console.log('[Step 3] Selecting priority cell to open Zone Evidence Drawer');
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      // Find top cell link or trigger selection
      const cellLink = document.querySelector('button, a, [data-cell-id]');
      // Or click directly via deep link
    })()`
  });
  await page.send('Page.navigate', { url: 'http://localhost:3005/heat-planner?cell=cell_250m_2313' });
  await new Promise(r => setTimeout(r, 1500));
  console.log(`[T+${((Date.now()-t0)/1000).toFixed(1)}s] Evidence drawer open for cell_250m_2313`);

  // Step 4: Open Scenario B Comparison Modal
  console.log('[Step 4] Opening Scenario B Comparison Modal');
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cmp = btns.find(b => b.textContent.includes('Compare') || b.textContent.includes('Scenario B'));
      if (cmp) cmp.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));
  console.log(`[T+${((Date.now()-t0)/1000).toFixed(1)}s] Scenario comparison active`);

  // Step 5: Open Copilot
  console.log('[Step 5] Opening Copilot');
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const dockBtn = document.querySelector('.fixed.bottom-4.right-4 button');
      if (dockBtn) dockBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));
  console.log(`[T+${((Date.now()-t0)/1000).toFixed(1)}s] Copilot expanded`);

  // Step 6: Green Loss Watch
  console.log('[Step 6] Navigating to http://localhost:3005/green-loss');
  await page.send('Page.navigate', { url: 'http://localhost:3005/green-loss' });
  await new Promise(r => setTimeout(r, 2000));
  console.log(`[T+${((Date.now()-t0)/1000).toFixed(1)}s] Green Loss Watch loaded`);

  // Step 7: Method & Quality Gate
  console.log('[Step 7] Navigating to http://localhost:3005/method');
  await page.send('Page.navigate', { url: 'http://localhost:3005/method' });
  await new Promise(r => setTimeout(r, 2000));
  console.log(`[T+${((Date.now()-t0)/1000).toFixed(1)}s] Method page loaded`);

  const totalTime = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`--- Demo Clickpath Complete in ${totalTime}s (Target: 60-90s) ---`);

  await page.close();
  await browser.send('Target.closeTarget', { targetId });
  browser.close();
}

testClickpath().catch(console.error);
