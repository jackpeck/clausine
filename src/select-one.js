#!/usr/bin/env node
// Select a single meal on a specific tab - designed for parallel sub-agent operation
// Each sub-agent runs this script on its assigned tab, discovers addons, and confirms
//
// Usage: node select-one.js <tab> <day> <mealType> <mealName> [--auto-addons]
//
// Example:
//   node select-one.js 0 2 Lunch "Chicken Bowl"
//   node select-one.js 1 3 Dinner "Beef Tacos" --auto-addons
//
// With --auto-addons, selects reasonable defaults (first option in required sections, no paid addons)
// Without --auto-addons, outputs available addons as JSON for the agent to decide

const fk = require('./forkable');

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 4) {
    console.error('Usage: node select-one.js <tab> <day> <mealType> <mealName> [--auto-addons]');
    console.error('  tab: 0-based tab index');
    console.error('  day: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri');
    console.error('  mealType: Lunch or Dinner');
    console.error('  mealName: Name of meal to select');
    process.exit(1);
  }

  const tabIndex = parseInt(args[0]);
  const day = parseInt(args[1]);
  const mealType = args[2];
  const mealName = args[3];
  const autoAddons = args.includes('--auto-addons');

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  console.log(`Tab ${tabIndex}: Selecting ${dayNames[day]} ${mealType} - "${mealName}"`);

  const { browser, page } = await fk.connectTab(tabIndex);

  try {
    // Step 1: Switch to correct meal type
    const switchResult = await fk.switchMealType(page, mealType);
    console.log(`  ${switchResult.message}`);

    // Step 2: Open the day's meal selection
    const openResult = await fk.openMealSelection(page, day);
    if (openResult.error) {
      console.error(`  Error opening day: ${openResult.error}`);
      process.exit(1);
    }
    console.log(`  Opened: ${openResult.text || 'meal selection'}`);

    // Step 3: Select the meal
    const selectResult = await fk.selectMeal(page, mealName);
    if (!selectResult.clicked) {
      console.error(`  Error selecting meal: ${selectResult.error}`);
      process.exit(1);
    }
    console.log(`  Selected: ${selectResult.text}`);

    // Step 4: Get available addons
    const addons = await fk.getAddons(page);
    const price = await fk.getCurrentPrice(page);

    console.log(`  Current price: ${price}`);

    if (addons.selections.length > 0 || addons.addons.length > 0) {
      console.log('\n  Available options:');

      if (addons.selections.length > 0) {
        console.log('  SELECTIONS (included):');
        addons.selections.forEach(s => {
          const check = s.selected ? '[x]' : '[ ]';
          console.log(`    ${check} ${s.name} (${s.section})`);
        });
      }

      if (addons.addons.length > 0) {
        console.log('  ADDONS (extra cost):');
        addons.addons.forEach(a => {
          const check = a.selected ? '[x]' : '[ ]';
          console.log(`    ${check} ${a.name} +$${a.price} (${a.section})`);
        });
      }

      if (autoAddons) {
        // Auto-select first unselected option in each required section
        const sections = new Set(addons.selections.map(s => s.section));
        for (const section of sections) {
          const sectionItems = addons.selections.filter(s => s.section === section);
          const hasSelection = sectionItems.some(s => s.selected);
          if (!hasSelection && sectionItems.length > 0) {
            const first = sectionItems[0];
            console.log(`  Auto-selecting: ${first.name}`);
            await fk.toggleAddon(page, first.name);
          }
        }
      } else {
        // Output JSON for agent to process
        console.log('\n  ADDON_JSON_START');
        console.log(JSON.stringify({ selections: addons.selections, addons: addons.addons, price }, null, 2));
        console.log('  ADDON_JSON_END');
        console.log('\n  Use tab-toggle to select addons, then tab-confirm to finalize');

        // Don't confirm - let the agent decide on addons first
        await browser.close();
        return;
      }
    }

    // Step 5: Confirm the selection
    const confirmResult = await fk.confirmMeal(page);
    if (!confirmResult.confirmed) {
      console.error(`  Error confirming: ${confirmResult.error}`);
      process.exit(1);
    }

    console.log(`\n  CONFIRMED at ${confirmResult.price}`);

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
