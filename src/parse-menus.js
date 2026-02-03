#!/usr/bin/env node
// Parse captured API responses into a clean format for Claude

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '../tmp/api-responses');
if (!fs.existsSync(API_DIR)) {
  console.error('No api-responses directory. Run: node capture-api.js');
  process.exit(1);
}

const files = fs.readdirSync(API_DIR).filter(f => f.startsWith('api-') && f.endsWith('.json'));

let allMenus = [];
let deliveries = null;

files.forEach(f => {
  const data = JSON.parse(fs.readFileSync(path.join(API_DIR, f)));
  if (data.data?.menus) {
    allMenus = allMenus.concat(data.data.menus);
  }
  if (data.data?.myDeliveries) {
    deliveries = data.data.myDeliveries;
  }
});

// Dedupe menus by id
const menuMap = new Map();
allMenus.forEach(m => menuMap.set(m.id, m));
const uniqueMenus = Array.from(menuMap.values());

// Format price from cents to dollars
const formatPrice = (cents) => `$${(cents / 100).toFixed(2)}`;

// Format ingredients/allergens
const formatIngredients = (ingredients) => {
  if (!ingredients || ingredients.length === 0) return '';
  const labels = {
    dairy: 'Dairy', gluten: 'Gluten', nuts: 'Nuts', soy: 'Soy',
    eggs: 'Eggs', seafood: 'Seafood', shellfish: 'Shellfish',
    spicy: 'Spicy', onion: 'Onion', sesame_seed: 'Sesame'
  };
  return ingredients.map(i => labels[i] || i).join(', ');
};

// Build clean menu output
let output = '# FORKABLE MEAL OPTIONS\n\n';

uniqueMenus.forEach(menu => {
  if (!menu.published?.sections) return;

  output += `## ${menu.name || menu.displayName}\n\n`;

  menu.published.sections.forEach(section => {
    if (!section.items || section.items.length === 0) return;
    if (section.deleted || section.disabled) return;

    if (section.name) {
      output += `### ${section.name}\n\n`;
    }

    section.items.forEach(item => {
      if (item.deleted || item.disabled) return;

      output += `**${item.name}** - ${formatPrice(item.price)}\n`;

      if (item.description) {
        const desc = item.description.trim().replace(/\n+/g, ' ').substring(0, 200);
        output += `${desc}\n`;
      }

      const tags = [];
      if (item.diet_level === 1) tags.push('Vegan');
      else if (item.diet_level === 2) tags.push('Vegetarian');
      else if (item.diet_level === 3) tags.push('Pescatarian');

      const allergens = formatIngredients(item.ingredients);
      if (allergens) tags.push(`Contains: ${allergens}`);

      if (tags.length > 0) {
        output += `[${tags.join(' | ')}]\n`;
      }

      output += '\n';
    });
  });

  output += '---\n\n';
});

// Add current deliveries/selections
if (deliveries && deliveries.length > 0) {
  output += '# CURRENT SELECTIONS\n\n';

  deliveries.forEach(d => {
    const date = new Date(d.forDeliveryAt);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const mealType = d.afternoon ? 'Dinner' : 'Lunch';

    output += `**${dayName} ${mealType}**\n`;
    output += `Budget: ${formatPrice(d.copayAmount * 100)}\n`;

    if (d.orders && d.orders.length > 0) {
      d.orders.forEach(order => {
        if (order.menu) {
          output += `Restaurant: ${order.menu.name}\n`;
        }
      });
    }

    output += '\n';
  });
}

// Write output
fs.writeFileSync(path.join(__dirname, '../tmp/menus.md'), output);
console.log('Written to tmp/menus.md');
console.log(`${uniqueMenus.length} restaurants, ${deliveries?.length || 0} deliveries`);
