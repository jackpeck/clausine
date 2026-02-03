#!/usr/bin/env node
// Write selection summary files with consistent formatting
// Usage: node write-summary.js <day> <mealType> <restaurant> <meal> <description> <price> <why> [addons...] --detail <file>
// Example: node write-summary.js wed dinner "Humbowl" "Brassica" "Broccoli, cauliflower..." "$20.25" "Only option without mushrooms" "Chicken (+$1.00)" --detail detail.md

const fs = require('fs');
const path = require('path');

const SELECTIONS_DIR = path.join(__dirname, '../selections');

// Parse arguments, extract --detail flag
const rawArgs = process.argv.slice(2);
let detailFile = null;
const detailIdx = rawArgs.indexOf('--detail');
if (detailIdx !== -1) {
  detailFile = rawArgs[detailIdx + 1];
  rawArgs.splice(detailIdx, 2);
}

const [dayArg, mealType, restaurant, meal, description, price, why, ...addonArgs] = rawArgs;

if (!dayArg || !mealType || !restaurant || !meal || !description || !price || !why || !detailFile) {
  console.error('Usage: node write-summary.js <day> <mealType> <restaurant> <meal> <description> <price> <why> [addons...] --detail <file>');
  console.error('Example: node write-summary.js wed dinner "Humbowl" "Brassica" "Broccoli..." "$20.25" "Only option" "Chicken (+$1)" --detail detail.md');
  process.exit(1);
}

// Map day names
const dayMap = {
  monday: { name: 'Monday', index: 0 }, mon: { name: 'Monday', index: 0 },
  tuesday: { name: 'Tuesday', index: 1 }, tue: { name: 'Tuesday', index: 1 },
  wednesday: { name: 'Wednesday', index: 2 }, wed: { name: 'Wednesday', index: 2 },
  thursday: { name: 'Thursday', index: 3 }, thu: { name: 'Thursday', index: 3 },
  friday: { name: 'Friday', index: 4 }, fri: { name: 'Friday', index: 4 }
};

const dayInfo = dayMap[dayArg.toLowerCase()];
if (!dayInfo) {
  console.error(`Invalid day: ${dayArg}`);
  process.exit(1);
}

const mealTypeCap = mealType.charAt(0).toUpperCase() + mealType.slice(1).toLowerCase();

// Calculate dates
const now = new Date();
const dayOfWeek = now.getDay();
const monday = new Date(now);
monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

const mealDate = new Date(monday);
mealDate.setDate(monday.getDate() + dayInfo.index);

const weekId = monday.toISOString().split('T')[0];
const dateStr = mealDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

// Ensure selections directory exists
if (!fs.existsSync(SELECTIONS_DIR)) {
  fs.mkdirSync(SELECTIONS_DIR);
}

// Normalize price - ensure it has $ prefix
function normalizePrice(p) {
  if (!p) return '$0.00';
  const clean = p.replace(/[^0-9.]/g, '');
  if (!clean) return p;
  return '$' + parseFloat(clean).toFixed(2);
}

// Normalize addon price format
function normalizeAddon(addon) {
  // Match patterns like "Name (+$X.XX)" or "Name (+X.XX)" or just numbers
  const match = addon.match(/^(.+?)\s*\(\+?\s*\$?(\d+\.?\d*)\s*\)$/);
  if (match) {
    return `${match[1]} (+$${parseFloat(match[2]).toFixed(2)})`;
  }
  return addon;
}

const normalizedPrice = normalizePrice(price);

// Format addons
const addonsStr = addonArgs.length ? addonArgs.map(normalizeAddon).join(', ') : 'None';

// Build summary entry
const entry = `## ${dayInfo.name} ${mealTypeCap} - ${dateStr}

**Restaurant:** ${restaurant}
**Meal:** ${meal} - ${description}
**Price:** ${normalizedPrice} (Budget: $25.00)
**Add-ons:** ${addonsStr}

**Why:** ${why}
`;

// Write or append to summary file
const summaryPath = path.join(SELECTIONS_DIR, `${weekId}.md`);
let summaryContent = '';

if (fs.existsSync(summaryPath)) {
  summaryContent = fs.readFileSync(summaryPath, 'utf-8');
  // Check if this day/meal already exists and replace it
  const sectionPattern = `## ${dayInfo.name} ${mealTypeCap} - [\\s\\S]*?(?=\\n## |$)`;
  const sectionRegex = new RegExp(sectionPattern);
  if (sectionRegex.test(summaryContent)) {
    summaryContent = summaryContent.replace(sectionRegex, entry.trim());
  } else {
    summaryContent += '\n' + entry;
  }
} else {
  const weekEnd = new Date(monday);
  weekEnd.setDate(monday.getDate() + 4);
  const weekRange = `${monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}-${weekEnd.getDate()}, ${monday.getFullYear()}`;
  summaryContent = `# Week of ${weekRange}\n\n${entry}`;
}

fs.writeFileSync(summaryPath, summaryContent);
console.log(`Summary: ${summaryPath}`);

// Write detail file
const detailContent = fs.readFileSync(detailFile, 'utf-8');
const detailPath = path.join(SELECTIONS_DIR, `${weekId}-${dayArg.toLowerCase()}-${mealType.toLowerCase()}-detail.md`);
fs.writeFileSync(detailPath, detailContent);
console.log(`Detail: ${detailPath}`);
