import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocket } from 'ws';

const BASE_URL = 'http://localhost:3005';
const OUT_DIR = path.resolve('docs/reference/screens');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function getBrowserWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/version', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.webSocketDebuggerUrl);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.events = [];
    this.onEvent = null;
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
          if (data.error) cb.reject(new Error(data.error.message));
          else cb.resolve(data.result);
        } else if (data.method && this.onEvent) {
          this.onEvent(data.method, data.params);
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

  close() {
    this.ws.close();
  }
}

async function capture(page, filename, width, height) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768
  });
  // Brief pause for reflow
  await new Promise(r => setTimeout(r, 600));
  const screenshot = await page.send('Page.captureScreenshot', { format: 'png' });
  const filepath = path.join(OUT_DIR, filename);
  fs.writeFileSync(filepath, Buffer.from(screenshot.data, 'base64'));
  console.log(`[Captured] ${filename} (${width}x${height})`);
}

async function run() {
  console.log('Connecting to Chrome CDP on 9222...');
  const wsUrl = await getBrowserWsUrl();
  const browser = new CDPClient(wsUrl);
  await browser.connect();

  const standardPages = [
    { route: '/', name: 'landing' },
    { route: '/heat-planner', name: 'heat_planner_default' },
    { route: '/heat-planner?cell=cell_250m_2313', name: 'heat_planner_zone_selected' },
    { route: '/green-loss', name: 'green_loss' },
    { route: '/interventions', name: 'interventions' },
    { route: '/green-cover', name: 'green_cover' },
    { route: '/infrastructure', name: 'infrastructure' },
    { route: '/solar', name: 'solar' },
    { route: '/method', name: 'method' }
  ];

  for (const item of standardPages) {
    console.log(`\nNavigating to ${item.route}...`);
    const pageTarget = await browser.send('Target.createTarget', { url: 'about:blank' });
    const targetId = pageTarget.targetId;
    const page = new CDPClient(`ws://127.0.0.1:9222/devtools/page/${targetId}`);
    await page.connect();

    await page.send('Page.enable');
    await page.send('Runtime.enable');

    // 1920x1080 desktop
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });
    await page.send('Page.navigate', { url: `${BASE_URL}${item.route}` });
    await new Promise(r => setTimeout(r, 3500)); // wait for network and render
    await capture(page, `${item.name}_1920x1080.png`, 1920, 1080);

    // 390px mobile
    await capture(page, `${item.name}_390px.png`, 390, 844);

    await page.close();
    await browser.send('Target.closeTarget', { targetId });
  }

  // Key State 1: Scenario B Comparison Modal Open
  console.log('\nCapturing Scenario B Comparison Modal...');
  {
    const pageTarget = await browser.send('Target.createTarget', { url: 'about:blank' });
    const targetId = pageTarget.targetId;
    const page = new CDPClient(`ws://127.0.0.1:9222/devtools/page/${targetId}`);
    await page.connect();
    await page.send('Page.enable');
    await page.send('Runtime.enable');

    await page.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: `${BASE_URL}/heat-planner` });
    await new Promise(r => setTimeout(r, 3500));

    // Click step 4 "Compare scenarios" or toggle scenario B
    await page.send('Runtime.evaluate', {
      expression: `(() => {
        // Find compare button or step 4
        const buttons = Array.from(document.querySelectorAll('button'));
        const compareBtn = buttons.find(b => b.textContent.includes('Compare') || b.textContent.includes('Scenario B'));
        if (compareBtn) compareBtn.click();
        const step4 = buttons.find(b => b.textContent.includes('Compare'));
        if (step4) step4.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 1200));

    // Open modal if compare button in scenario panel exists
    await page.send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const viewComparisonBtn = buttons.find(b => b.textContent.includes('View Comparison') || b.textContent.includes('Side-by-Side') || b.textContent.includes('Compare Scenarios'));
        if (viewComparisonBtn) viewComparisonBtn.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 1200));

    await capture(page, 'heat_planner_scenario_b_comparison_1920x1080.png', 1920, 1080);
    await capture(page, 'heat_planner_scenario_b_comparison_390px.png', 390, 844);

    await page.close();
    await browser.send('Target.closeTarget', { targetId });
  }

  // Key State 2: Copilot Open
  console.log('\nCapturing Copilot Open...');
  {
    const pageTarget = await browser.send('Target.createTarget', { url: 'about:blank' });
    const targetId = pageTarget.targetId;
    const page = new CDPClient(`ws://127.0.0.1:9222/devtools/page/${targetId}`);
    await page.connect();
    await page.send('Page.enable');
    await page.send('Runtime.enable');

    await page.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: `${BASE_URL}/heat-planner` });
    await new Promise(r => setTimeout(r, 3500));

    // Click copilot floating button
    await page.send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const copilotBtn = buttons.find(b => b.textContent.includes('Copilot') || b.getAttribute('aria-label')?.includes('copilot') || b.querySelector('svg'));
        const dockBtn = document.querySelector('.fixed.bottom-4.right-4 button') || buttons.find(b => b.textContent.includes('Climate Copilot'));
        if (dockBtn) dockBtn.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 1200));

    await capture(page, 'heat_planner_copilot_open_1920x1080.png', 1920, 1080);
    await capture(page, 'heat_planner_copilot_open_390px.png', 390, 844);

    await page.close();
    await browser.send('Target.closeTarget', { targetId });
  }

  browser.close();
  console.log('\nAll reference screens captured successfully into:', OUT_DIR);
}

run().catch(err => {
  console.error('Capture script error:', err);
  process.exit(1);
});
