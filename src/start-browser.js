const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '../.session');
const CDP_PORT = 9222;
const READY_FILE = path.join(__dirname, '../.browser-ready');

async function main() {
  console.log('Launching browser with remote debugging on port', CDP_PORT);

  // Clean up ready file if it exists
  if (fs.existsSync(READY_FILE)) fs.unlinkSync(READY_FILE);

  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: [`--remote-debugging-port=${CDP_PORT}`]
  });

  // Write ready file with PID so stop-browser.js can kill us
  fs.writeFileSync(READY_FILE, JSON.stringify({ port: CDP_PORT, pid: process.pid }));
  console.log('Browser ready on CDP port', CDP_PORT);

  // Navigate to Forkable
  const pages = context.pages();
  const page = pages[0] || await context.newPage();
  await page.goto('https://forkable.com/mc/', { waitUntil: 'networkidle' });
  console.log('Navigated to Forkable');

  console.log('\nBrowser running. Use browser-cmd.js to interact.');
  console.log('Press Ctrl+C to close.\n');

  // Keep alive
  process.on('SIGINT', async () => {
    console.log('\nClosing browser...');
    if (fs.existsSync(READY_FILE)) fs.unlinkSync(READY_FILE);
    await context.close();
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
