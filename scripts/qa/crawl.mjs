import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocket } from 'ws';

const ROUTES = [
  '/',
  '/heat-planner',
  '/green-loss',
  '/interventions',
  '/green-cover',
  '/infrastructure',
  '/solar',
  '/method'
];

const VIEWPORTS = [
  { width: 360, height: 800, name: '360' },
  { width: 390, height: 844, name: '390' },
  { width: 768, height: 1024, name: '768' },
  { width: 1280, height: 800, name: '1280' },
  { width: 1440, height: 900, name: '1440' }
];

const BASE_URL = 'http://localhost:3001';
const OUT_DIR = path.resolve('docs/qa/iter-2');

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
        } else if (data.method) {
          if (this.onEvent) this.onEvent(data.method, data.params);
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

async function run() {
  console.log('Connecting to Chrome CDP...');
  const wsUrl = await getBrowserWsUrl();
  console.log('Browser WS:', wsUrl);

  const browser = new CDPClient(wsUrl);
  await browser.connect();

  const auditLog = {
    timestamp: new Date().toISOString(),
    routesChecked: [],
    consoleErrors: [],
    failedRequests: [],
    overflows: [],
    anomalousTexts: []
  };

  for (const route of ROUTES) {
    console.log(`\n================ Testing route: ${route} ================`);
    const pageTarget = await browser.send('Target.createTarget', { url: 'about:blank' });
    const targetId = pageTarget.targetId;

    const pageWsUrl = `ws://127.0.0.1:9222/devtools/page/${targetId}`;
    const page = new CDPClient(pageWsUrl);
    await page.connect();

    const consoleMessages = [];
    const failedReqs = [];

    for (const vp of VIEWPORTS) {
      const pageTarget = await browser.send('Target.createTarget', { url: 'about:blank' });
      const targetId = pageTarget.targetId;
      const pageWsUrl = `ws://127.0.0.1:9222/devtools/page/${targetId}`;
      const page = new CDPClient(pageWsUrl);
      await page.connect();

      page.onEvent = (method, params) => {
        if (method === 'Runtime.consoleAPICalled') {
          const text = params.args.map(a => a.value || a.description || '').join(' ');
          if (params.type === 'error') {
            consoleMessages.push({ type: 'error', text, route, viewport: vp.name });
          }
        }
        if (method === 'Network.responseReceived') {
          const { response } = params;
          if (response.status >= 400) {
            failedReqs.push({ url: response.url, status: response.status, route, viewport: vp.name });
          }
        }
      };

      await page.send('Page.enable');
      await page.send('Runtime.enable');
      await page.send('Network.enable');

      await page.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 768
      });

      const fullUrl = `${BASE_URL}${route}`;
      await page.send('Page.navigate', { url: fullUrl });

      // Wait 3 seconds for hydration and network
      await new Promise(r => setTimeout(r, 3000));

      // Check horizontal overflow
      const overflowEval = await page.send('Runtime.evaluate', {
        expression: `({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        })`,
        returnByValue: true
      });
      const overflowResult = overflowEval.result?.value;
      if (overflowResult?.hasOverflow) {
        auditLog.overflows.push({
          route,
          viewport: vp.name,
          scrollWidth: overflowResult.scrollWidth,
          clientWidth: overflowResult.clientWidth
        });
      }

      // Check text anomalies
      const textEval = await page.send('Runtime.evaluate', {
        expression: `(() => {
          const bodyText = document.body.innerText || '';
          const matches = [];
          if (bodyText.includes('API KEY')) matches.push('API KEY');
          if (bodyText.includes('undefined')) matches.push('undefined');
          if (bodyText.includes('NaN')) matches.push('NaN');
          if (bodyText.includes('[object Object]')) matches.push('[object Object]');
          return matches;
        })()`,
        returnByValue: true
      });
      const textMatches = textEval.result?.value || [];
      if (textMatches.length > 0) {
        auditLog.anomalousTexts.push({
          route,
          viewport: vp.name,
          matches: textMatches
        });
      }

      // Capture screenshot
      const safeRoute = route === '/' ? 'home' : route.replace(/\//g, '_');
      const filename = `${safeRoute}_${vp.name}px.png`;
      const screenshot = await page.send('Page.captureScreenshot', { format: 'png' });
      const filepath = path.join(OUT_DIR, filename);
      fs.writeFileSync(filepath, Buffer.from(screenshot.data, 'base64'));
      console.log(`Saved screenshot: ${filename} (overflow: ${overflowResult?.hasOverflow})`);

      await page.close();
      await browser.send('Target.closeTarget', { targetId });
    }

    auditLog.routesChecked.push(route);
    auditLog.consoleErrors.push(...consoleMessages);
    auditLog.failedRequests.push(...failedReqs);
  }

  browser.close();

  const reportPath = path.join(OUT_DIR, 'crawl_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(auditLog, null, 2));
  console.log('\nAudit complete! Report saved to:', reportPath);
  console.log('Console errors:', auditLog.consoleErrors.length);
  console.log('Failed requests (4xx/5xx):', auditLog.failedRequests.length);
  console.log('Overflows:', auditLog.overflows.length);
  console.log('Text anomalies:', auditLog.anomalousTexts.length);
}

run().catch(err => {
  console.error('Crawl script failed:', err);
  process.exit(1);
});
