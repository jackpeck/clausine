const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const READY_FILE = path.join(__dirname, '../.browser-ready');
const CDP_PORT = 9222;
const API_DIR = path.join(__dirname, '../tmp/api-responses');

// Ensure api-responses dir exists
if (!fs.existsSync(API_DIR)) {
  fs.mkdirSync(API_DIR, { recursive: true });
}

async function main() {
  if (!fs.existsSync(READY_FILE)) {
    console.error('Browser not running. Start it with: node start-browser.js');
    process.exit(1);
  }

  const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  // Get CDP session
  const client = await page.context().newCDPSession(page);

  // Enable network monitoring
  await client.send('Network.enable');

  const responses = {};

  client.on('Network.responseReceived', async (params) => {
    const { requestId, response } = params;
    const url = response.url;

    if (url.includes('graphql') || url.includes('/api/') || url.includes('forkable')) {
      responses[requestId] = { url, status: response.status };
    }
  });

  client.on('Network.loadingFinished', async (params) => {
    const { requestId } = params;
    if (responses[requestId]) {
      try {
        const result = await client.send('Network.getResponseBody', { requestId });
        const body = result.body;

        if (body.length > 100) {
          const filename = `api-${Date.now()}.json`;
          console.log('\n' + '='.repeat(60));
          console.log('URL:', responses[requestId].url);
          console.log('Size:', body.length);

          try {
            const json = JSON.parse(body);
            fs.writeFileSync(path.join(API_DIR, filename), JSON.stringify(json, null, 2));
            console.log('Saved:', filename);

            // Show keys
            if (json.data) {
              console.log('Data keys:', Object.keys(json.data));
            }
          } catch {
            console.log('Not JSON');
          }
        }
      } catch (err) {
        // Body not available
      }
    }
  });

  console.log('Monitoring network requests...');
  console.log('Reload the page or navigate to capture API calls.\n');

  // Trigger reload
  console.log('Reloading page...');
  await page.reload({ waitUntil: 'networkidle' });

  console.log('\nDone. Check api-responses/*.json files.');
  console.log('Run: node parse-menus.js to generate menus.md');

  await browser.close();
}

main().catch(console.error);
