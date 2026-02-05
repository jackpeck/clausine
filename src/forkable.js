const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '../.session');
const READY_FILE = path.join(__dirname, '../.browser-ready');
const CDP_PORT = 9222;

// Connect to running browser
async function connect() {
  if (!fs.existsSync(READY_FILE)) {
    throw new Error('Browser not running. Start it with: node start-browser.js');
  }
  const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  return { browser, context, page };
}

// Connect and create multiple pages for parallel operations
async function connectMultiTab(numTabs) {
  if (!fs.existsSync(READY_FILE)) {
    throw new Error('Browser not running. Start it with: node start-browser.js');
  }
  const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
  const context = browser.contexts()[0];
  const mainPage = context.pages()[0];

  // Get the base URL from the main page
  const baseUrl = await mainPage.url();

  // Create additional pages
  const pages = [mainPage];
  for (let i = 1; i < numTabs; i++) {
    const newPage = await context.newPage();
    await newPage.goto(baseUrl);
    await newPage.waitForLoadState('networkidle');
    pages.push(newPage);
  }

  return { browser, context, pages };
}

// Connect to a specific tab by index (0-based)
async function connectTab(tabIndex) {
  if (!fs.existsSync(READY_FILE)) {
    throw new Error('Browser not running. Start it with: node start-browser.js');
  }
  const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
  const context = browser.contexts()[0];
  const pages = context.pages();

  if (tabIndex >= pages.length) {
    throw new Error(`Tab ${tabIndex} does not exist. Only ${pages.length} tabs open.`);
  }

  const page = pages[tabIndex];
  return { browser, context, page, tabIndex, totalTabs: pages.length };
}

// Open multiple tabs and return their count
async function openTabs(numTabs) {
  if (!fs.existsSync(READY_FILE)) {
    throw new Error('Browser not running. Start it with: node start-browser.js');
  }
  const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
  const context = browser.contexts()[0];
  const existingPages = context.pages();
  const mainPage = existingPages[0];

  // Get the base URL from the main page
  const baseUrl = await mainPage.url();

  // Create new tabs up to numTabs total
  const tabsToCreate = numTabs - existingPages.length;
  const newTabs = [];

  for (let i = 0; i < tabsToCreate; i++) {
    const newPage = await context.newPage();
    await newPage.goto(baseUrl);
    await newPage.waitForLoadState('networkidle');
    newTabs.push(existingPages.length + i);
  }

  const totalTabs = existingPages.length + newTabs.length;
  await browser.close();

  return {
    totalTabs,
    newTabs,
    existingTabs: existingPages.length,
    tabIndices: Array.from({ length: totalTabs }, (_, i) => i)
  };
}

// Close all tabs except the first one
async function closeTabs() {
  if (!fs.existsSync(READY_FILE)) {
    throw new Error('Browser not running. Start it with: node start-browser.js');
  }
  const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
  const context = browser.contexts()[0];
  const pages = context.pages();

  let closed = 0;
  for (let i = pages.length - 1; i > 0; i--) {
    await pages[i].close();
    closed++;
  }

  // Refresh the main page
  await pages[0].reload();
  await pages[0].waitForLoadState('networkidle');

  await browser.close();
  return { closed, remaining: 1 };
}

// Switch between Lunch and Dinner
async function switchMealType(page, type) {
  // type should be 'Lunch' or 'Dinner'
  const current = await page.evaluate(() => {
    const btn = document.querySelector('button.dropdown-toggle, [class*="meal-type"]');
    return btn?.innerText?.trim();
  });

  if (current?.toLowerCase().includes(type.toLowerCase())) {
    return { switched: false, message: `Already on ${type}` };
  }

  // Click to open dropdown
  await page.getByText(current?.includes('Lunch') ? 'Lunch' : 'Dinner', { exact: false }).first().click();
  await page.waitForTimeout(300);

  // Click the target type
  await page.getByText(type, { exact: true }).click();
  await page.waitForTimeout(500);

  return { switched: true, message: `Switched to ${type}` };
}

// Get all meals for the current week
async function getMeals(page) {
  await page.waitForTimeout(500);

  return await page.evaluate(() => {
    const meals = [];
    const dayDivs = document.querySelectorAll('.day.mb-6');

    dayDivs.forEach((dayDiv, index) => {
      const dateEl = dayDiv.querySelector('.user-meal-date');
      const date = dateEl?.innerText?.trim() || `Day ${index + 1}`;

      const mealInfo = dayDiv.querySelector('.day-meals-with-location');
      if (!mealInfo) {
        meals.push({ date, selected: false, needsSelection: true });
        return;
      }

      const restaurant = mealInfo.querySelector('.restaurant-name, [class*="restaurant"]')?.innerText?.trim();
      const mealName = mealInfo.querySelector('.meal-name, h4, h5, [class*="name"]')?.innerText?.trim();
      const description = mealInfo.querySelector('.meal-description, p, [class*="description"]')?.innerText?.trim();
      const hasChooseBtn = !!mealInfo.querySelector('button')?.innerText?.includes('Choose');

      // Check if it shows "CHOOSE MEAL FROM:" (unselected)
      const text = mealInfo.innerText;
      const needsSelection = text.includes('CHOOSE MEAL FROM:');

      meals.push({
        date,
        selected: !needsSelection,
        needsSelection,
        restaurant: restaurant || (needsSelection ? null : 'Unknown'),
        mealName: mealName || null,
        description: description?.substring(0, 100) || null
      });
    });

    return meals;
  });
}

// Navigate to meal selection for a specific day (0-indexed, 0=Monday)
// Page shows lunch (first 5 days) then dinner (second 5 days)
async function openMealSelection(page, dayIndex) {
  const result = await page.evaluate((idx) => {
    // Check if viewing dinner (adds offset of 5)
    const toggle = document.querySelector('button.dropdown-toggle, .meal-type-toggle');
    const isDinner = toggle?.innerText?.includes('Dinner');
    const actualIdx = isDinner ? idx + 5 : idx;

    const dayLabels = Array.from(document.querySelectorAll('.user-meal-date'));
    if (actualIdx >= dayLabels.length) return { error: `Day index ${idx} out of range` };

    const dayLabel = dayLabels[actualIdx];
    const dayDiv = dayLabel.closest('.day') || dayLabel.parentElement;
    const text = dayDiv.innerText;

    // If showing "CHOOSE MEAL FROM:", click the first restaurant button
    if (text.includes('CHOOSE MEAL FROM:')) {
      const buttons = Array.from(dayDiv.querySelectorAll('button'));
      const restaurantBtn = buttons.find(b => !b.innerText.includes('Choose') && b.innerText.trim().length > 0);
      if (restaurantBtn) {
        restaurantBtn.click();
        return { clicked: 'restaurant-button', text: restaurantBtn.innerText.substring(0, 30) };
      }
    }

    // Otherwise look for "Choose Another Meal" or "Add Meal" button
    const mealsDiv = dayDiv.querySelector('.day-meals-with-location') || dayDiv;
    const chooseBtn = Array.from(mealsDiv.querySelectorAll('button, a')).find(el =>
      el.innerText.includes('Choose') || el.innerText.includes('Add Meal')
    );

    if (chooseBtn) {
      chooseBtn.click();
      return { clicked: 'button', text: chooseBtn.innerText.substring(0, 30) };
    }

    return { error: 'No clickable element found for this day' };
  }, dayIndex);

  await page.waitForTimeout(1000);
  return result;
}

// Get available meal options (when in selection view)
async function getAvailableOptions(page) {
  await page.waitForTimeout(500);

  return await page.evaluate(() => {
    const options = [];

    // Find meal cards/items in the selection view
    const mealItems = document.querySelectorAll('.meal-item, .menu-item, [class*="meal-card"]');

    // Fallback: look for restaurant sections with meals
    if (mealItems.length === 0) {
      // Parse the visible text to extract meals
      const text = document.body.innerText;
      const lines = text.split('\n').filter(l => l.trim());

      let currentRestaurant = null;
      let currentMeal = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check for price pattern
        if (line.match(/^\$[\d.]+$/)) {
          if (currentMeal) {
            currentMeal.price = line;
            options.push(currentMeal);
            currentMeal = null;
          }
          continue;
        }

        // Check for restaurant names (all caps, specific patterns)
        if (line.match(/^[A-Z\s&']+$/) && line.length > 3 && line.length < 40) {
          currentRestaurant = line;
          continue;
        }

        // Check for allergen tags
        if (['Dairy', 'Gluten', 'Nuts', 'Soy', 'Eggs', 'Seafood'].includes(line)) {
          if (currentMeal) {
            currentMeal.allergens = currentMeal.allergens || [];
            currentMeal.allergens.push(line);
          }
          continue;
        }
      }
    }

    return options;
  });
}

// Select a meal by name
async function selectMeal(page, mealName) {
  const result = await page.evaluate((name) => {
    // Look in modal first, then full page
    const searchRoot = document.querySelector('.modal-content') || document.body;

    // Find meal cards - look for containers with meal info
    const mealCards = searchRoot.querySelectorAll('.meal-card, .menu-item, [class*="meal-item"], label[for], .item-details');

    // If no specific cards found, try finding by structure
    if (mealCards.length === 0) {
      // Look for elements that look like meal titles (h4, h5, strong, .name)
      const titles = Array.from(searchRoot.querySelectorAll('h4, h5, strong, .meal-name, [class*="name"]'));
      const matchingTitle = titles.find(el => {
        const text = el.innerText?.trim().toLowerCase() || '';
        return text === name.toLowerCase() || text.includes(name.toLowerCase());
      });

      if (matchingTitle) {
        // Click the parent card or the title itself
        const card = matchingTitle.closest('label, .meal-card, .menu-item, [class*="meal"]') || matchingTitle;
        card.click();
        return { clicked: true, text: matchingTitle.innerText.substring(0, 50) };
      }
    }

    // Search in found meal cards
    for (const card of mealCards) {
      const cardText = card.innerText?.toLowerCase() || '';
      if (cardText.includes(name.toLowerCase())) {
        card.click();
        return { clicked: true, text: card.innerText.substring(0, 50) };
      }
    }

    // Fallback: find input/radio buttons with meal names
    const inputs = searchRoot.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    for (const input of inputs) {
      const label = input.closest('label') || document.querySelector(`label[for="${input.id}"]`);
      if (label && label.innerText.toLowerCase().includes(name.toLowerCase())) {
        label.click();
        return { clicked: true, text: label.innerText.substring(0, 50) };
      }
    }

    return { clicked: false, error: `Meal "${name}" not found` };
  }, mealName);

  await page.waitForTimeout(1000);
  return result;
}

// Get addon options and prices from meal detail view
async function getAddons(page) {
  return await page.evaluate(() => {
    const result = { selections: [], addons: [] };
    const modal = document.querySelector('.modal-content') || document.body;

    // Find all fieldsets which contain option groups
    const fieldsets = modal.querySelectorAll('fieldset');

    fieldsets.forEach(fieldset => {
      // Get section name from legend
      const legend = fieldset.querySelector('legend');
      const sectionName = legend?.innerText?.trim() || 'Options';

      // Find custom-control divs (Bootstrap pattern: input and label are siblings)
      const controls = fieldset.querySelectorAll('.custom-control');
      controls.forEach(control => {
        const input = control.querySelector('input');
        const label = control.querySelector('label');
        if (!input || !label) return;

        const text = label.innerText?.trim();
        if (!text) return;

        const name = text.split('\n')[0].replace(/\+$/, '').trim();
        if (!name) return;

        // Check if it's a priced addon
        const priceEl = label.querySelector('[data-price]');
        if (priceEl) {
          const price = priceEl.getAttribute('data-price');
          result.addons.push({
            name,
            price: price,
            section: sectionName,
            selected: input.checked
          });
        } else {
          result.selections.push({
            name,
            section: sectionName,
            selected: input.checked
          });
        }
      });
    });

    return result;
  });
}

// Get current meal price from detail view
async function getCurrentPrice(page) {
  return await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Add for'));
    if (btn) {
      const match = btn.innerText.match(/\$[\d.]+/);
      return match ? match[0] : null;
    }
    return null;
  });
}

// Toggle an addon by name, optionally within a specific section
async function toggleAddon(page, addonName, sectionNum) {
  const result = await page.evaluate(({ name, section }) => {
    const modal = document.querySelector('.modal-content') || document.body;
    const fieldsets = modal.querySelectorAll('fieldset');

    // If section specified, find matching fieldset
    let targetFieldset = null;
    if (section) {
      const idx = parseInt(section) - 1;
      if (idx >= 0 && idx < fieldsets.length) {
        targetFieldset = fieldsets[idx];
      }
    }

    const searchRoot = targetFieldset || modal;
    const labels = Array.from(searchRoot.querySelectorAll('label'));
    const label = labels.find(l => l.innerText.toLowerCase().includes(name.toLowerCase()));

    if (label) {
      label.click();
      const fieldset = label.closest('fieldset');
      const sectionName = fieldset?.querySelector('legend')?.innerText?.trim() || '';
      return { toggled: true, text: label.innerText.substring(0, 30), section: sectionName };
    }
    return { toggled: false, error: `Addon "${name}" not found${section ? ` in section ${section}` : ''}` };
  }, { name: addonName, section: sectionNum });

  await page.waitForTimeout(300);
  return result;
}

// Confirm meal selection (click "Add for $X.XX" button)
async function confirmMeal(page) {
  const result = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Add for'));
    if (btn) {
      const price = btn.innerText.match(/\$[\d.]+/)?.[0];
      btn.click();
      return { confirmed: true, price };
    }
    return { confirmed: false, error: 'Add button not found' };
  });

  await page.waitForTimeout(1000);
  return result;
}

// Go back to main meal list
async function goBack(page) {
  await page.goBack();
  await page.waitForTimeout(1000);
}

// Read full page text (for debugging/analysis)
async function readPage(page) {
  return await page.evaluate(() => document.body.innerText);
}

// Find meals that haven't been selected yet (both lunch and dinner)
async function findUnselected(page) {
  return await page.evaluate(() => {
    const days = Array.from(document.querySelectorAll('.day'));
    // Page shows lunch (first 5 days) then dinner (second 5 days)
    const lunchDays = days.slice(0, 5);
    const dinnerDays = days.slice(5, 10);

    function findInDays(daysList) {
      const results = [];
      daysList.forEach(day => {
        const dateEl = day.querySelector('.user-meal-date');
        const date = dateEl?.innerText?.trim();
        if (!date) return;

        const text = day.innerText;
        if (text.includes('CHOOSE MEAL FROM:')) {
          const match = text.match(/CHOOSE MEAL FROM:\s*([\s\S]*?)(?:Cater|Delivery|$)/);
          let restaurants = [];
          if (match) {
            restaurants = match[1].split(/\s+OR\s+/).map(r => r.trim()).filter(r => r);
          }
          results.push({ date, restaurants });
        }
      });
      return results;
    }

    return {
      lunch: findInDays(lunchDays),
      dinner: findInDays(dinnerDays)
    };
  });
}

// Select a single meal with all steps (used by parallel selector)
// Returns { success, day, mealType, mealName, price, error }
async function selectMealComplete(page, { day, mealType, mealName, addons }) {
  const result = { day, mealType, mealName, success: false };

  try {
    // Switch to correct meal type (Lunch/Dinner)
    const switchResult = await switchMealType(page, mealType);
    result.switchResult = switchResult;

    // Open the day's meal selection
    const openResult = await openMealSelection(page, day);
    if (openResult.error) {
      result.error = openResult.error;
      return result;
    }
    result.openResult = openResult;

    // Select the meal
    const selectResult = await selectMeal(page, mealName);
    if (!selectResult.clicked) {
      result.error = selectResult.error || 'Failed to select meal';
      return result;
    }
    result.selectResult = selectResult;

    // Toggle any addons if specified
    if (addons && addons.length > 0) {
      result.addonResults = [];
      for (const addon of addons) {
        const addonResult = await toggleAddon(page, addon.name, addon.section);
        result.addonResults.push(addonResult);
      }
    }

    // Confirm the selection
    const confirmResult = await confirmMeal(page);
    if (!confirmResult.confirmed) {
      result.error = confirmResult.error || 'Failed to confirm meal';
      return result;
    }
    result.price = confirmResult.price;
    result.success = true;

    return result;
  } catch (err) {
    result.error = err.message;
    return result;
  }
}

// Select multiple meals in parallel using multiple browser tabs
// selections: Array of { day: 0-4, mealType: 'Lunch'|'Dinner', mealName: string, addons?: [{name, section?}] }
async function selectMealsParallel(selections) {
  if (!selections || selections.length === 0) {
    return { success: false, error: 'No selections provided' };
  }

  const numTabs = selections.length;
  console.log(`Opening ${numTabs} tabs for parallel meal selection...`);

  const { browser, context, pages } = await connectMultiTab(numTabs);

  try {
    console.log(`Selecting ${numTabs} meals in parallel...`);

    // Run all selections in parallel
    const results = await Promise.all(
      selections.map((selection, i) =>
        selectMealComplete(pages[i], selection)
      )
    );

    // Close extra tabs (keep only the first one)
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close();
    }

    // Refresh the main page to show updated state
    await pages[0].reload();
    await pages[0].waitForLoadState('networkidle');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return {
      success: failed.length === 0,
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      results
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  connect,
  connectMultiTab,
  connectTab,
  openTabs,
  closeTabs,
  switchMealType,
  getMeals,
  openMealSelection,
  getAvailableOptions,
  selectMeal,
  getAddons,
  getCurrentPrice,
  toggleAddon,
  confirmMeal,
  goBack,
  readPage,
  findUnselected,
  selectMealComplete,
  selectMealsParallel
};
