#!/usr/bin/env node
// Stop the running browser and clean up
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const READY_FILE = path.join(__dirname, '../.browser-ready');
const CDP_PORT = 9222;

async function main() {
  if (!fs.existsSync(READY_FILE)) {
    console.log('Browser not running.');
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(READY_FILE, 'utf-8'));
    if (data.pid) {
      process.kill(data.pid, 'SIGINT');
      console.log('Browser closed.');
    }
  } catch (err) {
    console.log('Could not stop browser:', err.message);
  }

  // Clean up ready file
  if (fs.existsSync(READY_FILE)) {
    fs.unlinkSync(READY_FILE);
  }
}

main();
