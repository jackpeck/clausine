#!/usr/bin/env node
// Simple CLI for Forkable interactions
// Usage: node fk.js <command> [args]

const fk = require('./forkable');
const { execSync } = require('child_process');
const path = require('path');

const commands = {
  async meals() {
    const { browser, page } = await fk.connect();
    try {
      const meals = await fk.getMeals(page);
      console.log(JSON.stringify(meals, null, 2));
    } finally {
      await browser.close();
    }
  },

  async lunch() {
    const { browser, page } = await fk.connect();
    try {
      const result = await fk.switchMealType(page, 'Lunch');
      console.log(result.message);
    } finally {
      await browser.close();
    }
  },

  async dinner() {
    const { browser, page } = await fk.connect();
    try {
      const result = await fk.switchMealType(page, 'Dinner');
      console.log(result.message);
    } finally {
      await browser.close();
    }
  },

  async open(dayIndex) {
    const { browser, page } = await fk.connect();
    try {
      const idx = parseInt(dayIndex) || 0;
      const result = await fk.openMealSelection(page, idx);
      console.log(JSON.stringify(result, null, 2));
    } finally {
      await browser.close();
    }
  },

  async select(mealName) {
    const { browser, page } = await fk.connect();
    try {
      const result = await fk.selectMeal(page, mealName);
      console.log(JSON.stringify(result, null, 2));
    } finally {
      await browser.close();
    }
  },

  async addons() {
    const { browser, page } = await fk.connect();
    try {
      const result = await fk.getAddons(page);
      console.log(JSON.stringify(result, null, 2));
    } finally {
      await browser.close();
    }
  },

  async selected() {
    const { browser, page } = await fk.connect();
    try {
      const selected = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('input:checked').forEach(el => {
          const label = el.closest('label')?.innerText?.trim();
          if (label && !label.includes('MTuWThF')) {
            items.push(label.replace(/\n\+$/, '').trim());
          }
        });
        return items;
      });
      const price = await fk.getCurrentPrice(page);
      console.log('Selected options:', selected);
      console.log('Price:', price);
    } finally {
      await browser.close();
    }
  },

  async ratings() {
    const { browser, page } = await fk.connect();
    try {
      const ratings = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('.day').forEach(day => {
          const ratingImg = day.querySelector('.corner-link img[src*="level-"]');
          if (!ratingImg) return;

          const ratingMatch = ratingImg.src.match(/level-(\d)/);
          if (!ratingMatch) return;

          const text = day.innerText;
          const lines = text.split('\n').map(l => l.trim()).filter(l => l);

          // Find date line (e.g., "Monday Jan 19")
          const date = lines.find(l => /^(Monday|Tuesday|Wednesday|Thursday|Friday)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+/.test(l));

          // Find DELIVERED marker and get restaurant/meal after it
          const deliveredIdx = lines.findIndex(l => l === 'DELIVERED');
          if (deliveredIdx === -1) return;

          // Skip the code (A2, A4, etc.) - it's typically right after DELIVERED
          // Restaurant is ALL CAPS, meal name follows
          let restaurant = null;
          let meal = null;

          for (let i = deliveredIdx + 1; i < Math.min(deliveredIdx + 5, lines.length); i++) {
            const line = lines[i];
            // Skip short codes like A2, A4, etc.
            if (/^[A-Z]\d+$/.test(line)) continue;
            // Restaurant is ALL CAPS (may have spaces, &, ')
            if (!restaurant && /^[A-Z][A-Z\s&'0-9]+$/.test(line) && line.length > 2) {
              restaurant = line;
              continue;
            }
            // Meal name is next non-empty line after restaurant
            if (restaurant && !meal && line.length > 2) {
              meal = line;
              break;
            }
          }

          if (restaurant && meal) {
            results.push({
              rating: parseInt(ratingMatch[1]),
              date,
              restaurant,
              meal
            });
          }
        });
        return results;
      });

      const weekText = await page.evaluate(() =>
        document.querySelector('.week-nav__date')?.innerText || 'Unknown week'
      );

      console.log(`Ratings for ${weekText}:\n`);
      if (ratings.length === 0) {
        console.log('No ratings found.');
      } else {
        ratings.forEach(r => {
          console.log(`- ${r.date}: ${r.meal} (${r.restaurant}) - ${r.rating}/5`);
        });
      }
    } finally {
      await browser.close();
    }
  },

  async price() {
    const { browser, page } = await fk.connect();
    try {
      const price = await fk.getCurrentPrice(page);
      console.log(price || 'No price found');
    } finally {
      await browser.close();
    }
  },

  async toggle(addonName, sectionNum) {
    const { browser, page } = await fk.connect();
    try {
      const result = await fk.toggleAddon(page, addonName, sectionNum);
      console.log(JSON.stringify(result, null, 2));
    } finally {
      await browser.close();
    }
  },

  async notes(text) {
    const { browser, page } = await fk.connect();
    try {
      const modal = await page.$('.modal-content') || await page.$('body');
      const textarea = await modal.$('textarea');
      if (textarea) {
        await textarea.fill(text || '');
        console.log(`Notes set to: "${text || ''}"`);
      } else {
        console.log('Notes field not found');
      }
    } finally {
      await browser.close();
    }
  },

  async confirm() {
    const { browser, page } = await fk.connect();
    try {
      const result = await fk.confirmMeal(page);
      console.log(JSON.stringify(result, null, 2));
    } finally {
      await browser.close();
    }
  },

  async back() {
    const { browser, page } = await fk.connect();
    try {
      await fk.goBack(page);
      console.log('Went back');
    } finally {
      await browser.close();
    }
  },

  async read() {
    const { browser, page } = await fk.connect();
    try {
      const text = await fk.readPage(page);
      console.log(text);
    } finally {
      await browser.close();
    }
  },

  async refresh() {
    console.log('Capturing API responses...');
    execSync('node capture-api.js', { stdio: 'inherit', cwd: __dirname });
    console.log('\nParsing menus...');
    execSync('node parse-menus.js', { stdio: 'inherit', cwd: __dirname });
  },

  options(day, meal) {
    // Show available options for a day/meal
    const args = [day || 'friday', meal || 'lunch'].filter(Boolean).join(' ');
    execSync(`node get-options.js ${args}`, { stdio: 'inherit', cwd: __dirname });
  },

  async unselected() {
    const { browser, page } = await fk.connect();
    try {
      const { lunch, dinner } = await fk.findUnselected(page);

      if (lunch.length === 0 && dinner.length === 0) {
        console.log('All meals are selected.');
        return;
      }

      if (lunch.length > 0) {
        console.log('Unselected LUNCH:');
        lunch.forEach(u => {
          console.log(`  - ${u.date}`);
          console.log(`    Restaurants: ${u.restaurants.join(', ')}`);
        });
      }

      if (dinner.length > 0) {
        if (lunch.length > 0) console.log('');
        console.log('Unselected DINNER:');
        dinner.forEach(u => {
          console.log(`  - ${u.date}`);
          console.log(`    Restaurants: ${u.restaurants.join(', ')}`);
        });
      }
    } finally {
      await browser.close();
    }
  },

  // Select multiple meals in parallel using multiple browser tabs
  // Usage: node fk.js select-all '[{"day":0,"mealType":"Lunch","mealName":"Chicken Bowl"},...]'
  // Or: node fk.js select-all selections.json
  // Open multiple browser tabs for parallel operation
  async 'open-tabs'(numTabs) {
    const n = parseInt(numTabs) || 5;
    console.log(`Opening ${n} tabs...`);
    const result = await fk.openTabs(n);
    console.log(`Tabs ready: ${result.tabIndices.join(', ')}`);
    console.log(`\nUse --tab <n> with commands to operate on specific tabs, or run select-one.js`);
    console.log(JSON.stringify(result, null, 2));
  },

  // Close all tabs except the first one
  async 'close-tabs'() {
    const result = await fk.closeTabs();
    console.log(`Closed ${result.closed} tabs. ${result.remaining} tab remaining.`);
  },

  // Tab-specific commands: open a meal selection on a specific tab
  async 'tab-open'(tabIndex, dayIndex) {
    const tab = parseInt(tabIndex) || 0;
    const day = parseInt(dayIndex) || 0;
    const { browser, page } = await fk.connectTab(tab);
    try {
      const result = await fk.openMealSelection(page, day);
      console.log(JSON.stringify(result, null, 2));
    } finally {
      await browser.close();
    }
  },

  // Tab-specific: switch meal type on a specific tab
  async 'tab-lunch'(tabIndex) {
    const tab = parseInt(tabIndex) || 0;
    const { browser, page } = await fk.connectTab(tab);
    try {
      const result = await fk.switchMealType(page, 'Lunch');
      console.log(`Tab ${tab}: ${result.message}`);
    } finally {
      await browser.close();
    }
  },

  async 'tab-dinner'(tabIndex) {
    const tab = parseInt(tabIndex) || 0;
    const { browser, page } = await fk.connectTab(tab);
    try {
      const result = await fk.switchMealType(page, 'Dinner');
      console.log(`Tab ${tab}: ${result.message}`);
    } finally {
      await browser.close();
    }
  },

  // Tab-specific: select a meal on a specific tab
  async 'tab-select'(tabIndex, mealName) {
    const tab = parseInt(tabIndex) || 0;
    const { browser, page } = await fk.connectTab(tab);
    try {
      const result = await fk.selectMeal(page, mealName);
      console.log(JSON.stringify(result, null, 2));
    } finally {
      await browser.close();
    }
  },

  // Tab-specific: get addons on a specific tab
  async 'tab-addons'(tabIndex) {
    const tab = parseInt(tabIndex) || 0;
    const { browser, page } = await fk.connectTab(tab);
    try {
      const result = await fk.getAddons(page);
      console.log(JSON.stringify(result, null, 2));
    } finally {
      await browser.close();
    }
  },

  // Tab-specific: toggle addon on a specific tab
  async 'tab-toggle'(tabIndex, addonName, sectionNum) {
    const tab = parseInt(tabIndex) || 0;
    const { browser, page } = await fk.connectTab(tab);
    try {
      const result = await fk.toggleAddon(page, addonName, sectionNum);
      console.log(JSON.stringify(result, null, 2));
    } finally {
      await browser.close();
    }
  },

  // Tab-specific: confirm meal on a specific tab
  async 'tab-confirm'(tabIndex) {
    const tab = parseInt(tabIndex) || 0;
    const { browser, page } = await fk.connectTab(tab);
    try {
      const result = await fk.confirmMeal(page);
      console.log(JSON.stringify(result, null, 2));
    } finally {
      await browser.close();
    }
  },

  // Tab-specific: read page content
  async 'tab-read'(tabIndex) {
    const tab = parseInt(tabIndex) || 0;
    const { browser, page } = await fk.connectTab(tab);
    try {
      const text = await fk.readPage(page);
      console.log(text);
    } finally {
      await browser.close();
    }
  },

  async 'select-all'(jsonArg) {
    let selections;

    // Try to parse as JSON or read from file
    if (jsonArg.startsWith('[')) {
      selections = JSON.parse(jsonArg);
    } else if (jsonArg.endsWith('.json')) {
      const fs = require('fs');
      const content = fs.readFileSync(path.join(__dirname, '..', jsonArg), 'utf8');
      selections = JSON.parse(content);
    } else {
      console.error('Argument must be JSON array or path to .json file');
      process.exit(1);
    }

    console.log(`Selecting ${selections.length} meals in parallel...`);
    selections.forEach((s, i) => {
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      console.log(`  ${i + 1}. ${dayNames[s.day]} ${s.mealType}: ${s.mealName}`);
    });
    console.log('');

    const result = await fk.selectMealsParallel(selections);

    console.log('\n=== Results ===');
    console.log(`Total: ${result.total}, Successful: ${result.successful}, Failed: ${result.failed}`);
    console.log('');

    result.results.forEach((r, i) => {
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const status = r.success ? '✓' : '✗';
      const price = r.price || '';
      const error = r.error ? ` - Error: ${r.error}` : '';
      console.log(`${status} ${dayNames[r.day]} ${r.mealType}: ${r.mealName} ${price}${error}`);
    });
  },

  help() {
    console.log(`Forkable CLI

Commands:
  meals           - List all meals for current week
  lunch           - Switch to Lunch view
  dinner          - Switch to Dinner view
  open <day>      - Open meal selection for day (0=Mon, 4=Fri)
  select <name>   - Select a meal by name
  select-all <json> - Select multiple meals in parallel (multi-tab)
                     JSON format: [{"day":0,"mealType":"Lunch","mealName":"..."},...]
                     Or pass path to .json file
  addons          - List available addons and prices
  selected        - Show currently selected options
  price           - Get current meal price
  toggle <addon> [section] - Toggle addon (section=1,2,3... for specific group)
  notes <text>    - Set notes for the meal
  confirm         - Confirm meal selection
  back            - Go back to main view
  read            - Read full page text
  refresh         - Reload page and regenerate menus.md
  options <day> <meal> - Show options for day (mon-fri) and meal (lunch/dinner)
  unselected      - Find meals without selections

Multi-Tab Commands (for parallel sub-agent operation):
  open-tabs <n>   - Open n browser tabs for parallel operation
  close-tabs      - Close all tabs except the first one
  tab-lunch <tab> - Switch tab to Lunch view
  tab-dinner <tab> - Switch tab to Dinner view
  tab-open <tab> <day> - Open meal selection on specific tab
  tab-select <tab> <name> - Select meal on specific tab
  tab-addons <tab> - List addons on specific tab
  tab-toggle <tab> <addon> [section] - Toggle addon on specific tab
  tab-confirm <tab> - Confirm meal on specific tab
  tab-read <tab>  - Read page content from specific tab

  help            - Show this help
`);
  }
};

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd || !commands[cmd]) {
    commands.help();
    return;
  }

  try {
    await commands[cmd](...args);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
