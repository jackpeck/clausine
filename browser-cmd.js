const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const READY_FILE = path.join(__dirname, '.browser-ready');
const CDP_PORT = 9222;

async function connect() {
  if (!fs.existsSync(READY_FILE)) {
    console.error('Browser not running. Start it with: node start-browser.js');
    process.exit(1);
  }

  const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    console.error('No browser contexts found');
    process.exit(1);
  }
  const context = contexts[0];
  const pages = context.pages();
  if (pages.length === 0) {
    console.error('No pages found');
    process.exit(1);
  }
  const page = pages[0];
  return { browser, context, page };
}

async function main() {
  const args = process.argv.slice(2);
  const action = args[0];

  if (!action) {
    console.log(`Usage: node browser-cmd.js <action> [args]

Actions:
  read              - Read visible text from page
  html              - Get full HTML (saved to page-debug.html)
  url               - Get current URL
  click <text>      - Click element containing text
  clicksel <sel>    - Click element by CSS selector
  goto <url>        - Navigate to URL
  screenshot [name] - Take screenshot (default: screenshot.png)
  eval <js>         - Evaluate JavaScript in page
  wait <ms>         - Wait milliseconds
  back              - Go back
  reload            - Reload page
`);
    return;
  }

  const { browser, page } = await connect();

  try {
    switch (action) {
      case 'read': {
        const text = await page.evaluate(() => document.body.innerText);
        console.log(text);
        break;
      }

      case 'html': {
        const html = await page.content();
        fs.writeFileSync(path.join(__dirname, 'page-debug.html'), html);
        console.log('HTML saved to page-debug.html');
        break;
      }

      case 'url': {
        console.log(page.url());
        break;
      }

      case 'click': {
        const text = args.slice(1).join(' ');
        if (!text) {
          console.error('Usage: click <text to find>');
          break;
        }
        try {
          const element = await page.getByText(text, { exact: false }).first();
          await element.click();
          console.log(`Clicked: "${text}"`);
          await page.waitForTimeout(1000);
        } catch (e) {
          console.error(`Could not find/click "${text}": ${e.message}`);
        }
        break;
      }

      case 'clicksel': {
        const selector = args[1];
        if (!selector) {
          console.error('Usage: clicksel <css-selector>');
          break;
        }
        await page.click(selector);
        console.log(`Clicked selector: ${selector}`);
        await page.waitForTimeout(1000);
        break;
      }

      case 'goto': {
        const url = args[1];
        if (!url) {
          console.error('Usage: goto <url>');
          break;
        }
        await page.goto(url, { waitUntil: 'networkidle' });
        console.log(`Navigated to: ${url}`);
        break;
      }

      case 'screenshot': {
        const name = args[1] || 'screenshot.png';
        const filepath = path.join(__dirname, name);
        await page.screenshot({ path: filepath, fullPage: false });
        console.log(`Screenshot saved to ${filepath}`);
        break;
      }

      case 'eval': {
        const js = args.slice(1).join(' ');
        if (!js) {
          console.error('Usage: eval <javascript>');
          break;
        }
        const result = await page.evaluate(js);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'wait': {
        const ms = parseInt(args[1]) || 1000;
        await page.waitForTimeout(ms);
        console.log(`Waited ${ms}ms`);
        break;
      }

      case 'back': {
        await page.goBack();
        console.log('Went back');
        await page.waitForTimeout(1000);
        break;
      }

      case 'reload': {
        await page.reload({ waitUntil: 'networkidle' });
        console.log('Reloaded');
        break;
      }

      default:
        console.error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

main();
