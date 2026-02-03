#!/usr/bin/env node
// Extract meal options for a specific day/meal type
// Usage: node get-options.js <day> <lunch|dinner>
// Example: node get-options.js friday lunch

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, 'api-responses');
const PREFS_FILE = path.join(__dirname, 'meal_preferences.txt');

// Parse arguments
const args = process.argv.slice(2);
const dayArg = (args[0] || 'friday').toLowerCase();
const mealType = (args[1] || 'lunch').toLowerCase();

// Map day names to indices
const dayMap = {
  monday: 0, mon: 0,
  tuesday: 1, tue: 1,
  wednesday: 2, wed: 2,
  thursday: 3, thu: 3,
  friday: 4, fri: 4
};

const dayIndex = dayMap[dayArg] ?? parseInt(dayArg) ?? 4;
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const dayName = dayNames[dayIndex] || 'Friday';

// Load API data
const files = fs.readdirSync(API_DIR).filter(f => f.endsWith('.json'));

let deliveries = null;
let allMenus = [];

files.forEach(f => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(API_DIR, f)));
    if (data.data?.myDeliveries) deliveries = data.data.myDeliveries;
    if (data.data?.menus) allMenus = allMenus.concat(data.data.menus);
  } catch {}
});

// Dedupe menus
const menuMap = new Map();
allMenus.forEach(m => menuMap.set(m.id, m));

// Find the delivery for the requested day/meal
const isAfternoon = mealType === 'dinner';
const delivery = deliveries?.find(d => {
  const date = new Date(d.forDeliveryAt);
  const dow = date.getDay(); // 0=Sun, 1=Mon, etc
  const targetDow = dayIndex + 1; // Our dayIndex is 0=Mon, so +1
  return dow === targetDow && d.afternoon === isAfternoon;
});

if (!delivery) {
  console.error(`No delivery found for ${dayName} ${mealType}`);
  process.exit(1);
}

// Get available menu IDs for this delivery
const availableMenuIds = delivery.availableMenuIds || [];

// Filter menus to only available ones
const availableMenus = availableMenuIds
  .map(id => menuMap.get(id))
  .filter(Boolean);

// Format price
const formatPrice = (cents) => `$${(cents / 100).toFixed(2)}`;

// Format ingredients
const ingredientLabels = {
  dairy: 'Dairy', gluten: 'Gluten', nuts: 'Nuts', soy: 'Soy',
  eggs: 'Eggs', seafood: 'Seafood', shellfish: 'Shellfish',
  spicy: 'Spicy', onion: 'Onion', sesame_seed: 'Sesame',
  beef: 'Beef', pork: 'Pork', poultry: 'Poultry'
};

// Output
console.log(`# ${dayName} ${mealType.charAt(0).toUpperCase() + mealType.slice(1)} Options`);
console.log(`Budget: ${formatPrice(delivery.copayAmount * 100)}`);
console.log(`Available restaurants: ${availableMenus.length}`);
console.log('');

// Load preferences
if (fs.existsSync(PREFS_FILE)) {
  console.log('## My Preferences');
  console.log(fs.readFileSync(PREFS_FILE, 'utf-8'));
  console.log('');
}

console.log('## Available Meals\n');

availableMenus.forEach(menu => {
  if (!menu.published?.sections) return;

  console.log(`### ${menu.name || menu.displayName}\n`);

  menu.published.sections.forEach(section => {
    if (!section.items?.length || section.deleted || section.disabled) return;

    if (section.name) {
      console.log(`#### ${section.name}\n`);
    }

    section.items.forEach(item => {
      if (item.deleted || item.disabled) return;

      let line = `**${item.name}** - ${formatPrice(item.price)}`;

      // Diet level
      const dietLabels = { 1: 'Vegan', 2: 'Vegetarian', 3: 'Pescatarian' };
      if (dietLabels[item.diet_level]) {
        line += ` [${dietLabels[item.diet_level]}]`;
      }

      console.log(line);

      if (item.description) {
        const desc = item.description.trim().replace(/\n+/g, ' ').substring(0, 150);
        console.log(desc);
      }

      // Allergens/ingredients
      if (item.ingredients?.length) {
        const labels = item.ingredients.map(i => ingredientLabels[i] || i).join(', ');
        console.log(`Contains: ${labels}`);
      }

      console.log('');
    });
  });

  console.log('---\n');
});
