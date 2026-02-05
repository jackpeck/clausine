# Forkable Meal Selection Instructions

## Purpose

This tool helps select work meals from Forkable (a corporate meal ordering service). Claude reviews available meal options, applies User's preferences from `user_preferences.txt`, and selects the best meals for days that don't have selections yet. Each selection is documented with a short summary and detailed reasoning.

## First Run Setup

Read `./user_preferences.txt` (in the repo root). If it doesn't exist, ask the user:
1. Any ingredients to avoid? (allergies, dislikes)
2. Favorite cuisines or types of food?
3. Any restaurants or dishes they already know they like/dislike?

Create `user_preferences.txt` with their answers. Budget is always $25/meal.

## Starting the Browser

First, check that playwright is installed:

```bash
src/check-playwright.sh
```

If playwright is not installed, run `npm install` to install dependencies.

Then start the browser:

```bash
src/start-browser-background.sh
src/wait-for-browser-ready.sh
```

This opens a Chromium browser with a persistent session. On the first run, User must log in to https://forkable.com/mc/ manually. Session cookies are persisted in `.session/` so future runs won't require login.

To stop the browser:
```bash
src/stop-browser.sh
```

## Refreshing Data

Before selecting meals, Claude should refresh the API data to get the latest menu options:

```bash
node src/fk.js refresh
```

This captures GraphQL responses and regenerates `menus.md` with current availability.

## Selecting Meals

**ALWAYS use the parallel multi-tab method with sub-agents.** This selects all meals simultaneously across multiple browser tabs, with each sub-agent discovering and choosing addons independently.

### 1. Check Available Options

```bash
node src/fk.js options <day> <lunch|dinner>
```

This shows all available meals for a day/meal type, along with User's preferences from `user_preferences.txt`. Claude should review the options and choose the best match for each day.

### 2. Open Tabs (one per meal)

```bash
node src/fk.js open-tabs <n>
```

Open one tab per unselected meal. A full week can have up to 10 meals (Mon-Fri lunch + dinner).

Example: `node src/fk.js open-tabs 10` opens 10 tabs for a full week.

### 3. Spawn Sub-Agents in Parallel

Each sub-agent runs independently on its assigned tab. Tab indices are 0-based and can be assigned to any day/meal combination:

```bash
# Sub-agent 0: Tab 0, Monday Lunch
node src/select-one.js 0 0 Lunch "Chicken Bowl"
# Shows available addons, agent decides, then:
node src/fk.js tab-toggle 0 "Extra Protein"
node src/fk.js tab-confirm 0

# Sub-agent 1: Tab 1, Monday Dinner (runs in parallel)
node src/select-one.js 1 0 Dinner "Pasta Primavera"
node src/fk.js tab-confirm 1

# Sub-agent 2: Tab 2, Tuesday Lunch (runs in parallel)
node src/select-one.js 2 1 Lunch "Beef Tacos"
node src/fk.js tab-toggle 2 "Guacamole"
node src/fk.js tab-confirm 2

# ... more sub-agents for remaining days (up to 10 total for full week)
```

The `select-one.js` script:
- Switches to the correct meal type (Lunch/Dinner)
- Opens the day's meal selection
- Selects the specified meal
- Outputs available addons as JSON for the agent to decide
- Does NOT confirm - the agent must call `tab-confirm` after selecting addons

### 4. Clean Up Tabs

```bash
node src/fk.js close-tabs
```

### Tab-Specific Commands

- `tab-lunch <tab>` / `tab-dinner <tab>` - Switch meal type on tab
- `tab-open <tab> <day>` - Open meal selection (0=Mon, 4=Fri)
- `tab-select <tab> <name>` - Select a meal
- `tab-addons <tab>` - View available addons
- `tab-toggle <tab> <addon> [section]` - Toggle an addon
- `tab-notes <tab> <text>` - Set notes on specific tab
- `tab-price <tab>` - Get current price on specific tab
- `tab-confirm <tab>` - Confirm the selection
- `tab-read <tab>` - Read page content

For meals with multiple required selections (e.g., "Choose Rice Type"), use the section number parameter with tab-toggle to target specific groups.

### 5. Record the Selection

Claude should always record both a short summary and a detailed explanation. Write the detailed markdown to a file first, then:

```bash
node src/write-summary.js <day> <mealType> "<restaurant>" "<meal>" "<description>" '<price>' "<why>" '<addon1>' '<addon2>' --detail <detail-file>
```

- `<day>` - Use day names: mon, tue, wed, thu, fri (not numbers like fk.js)
- `<price>` - Use single quotes or omit $ to avoid shell expansion (e.g., `'22.00'` or `'$22.00'`)
- `<addon>` - Format as `'Name (+6.00)'` - script will normalize to `Name (+$6.00)`
- `<why>` - One sentence explaining why this meal was picked
- `<detail-file>` - Path to markdown file with full analysis of options considered, constraints applied, and reasoning

## Task: Select Meals for Unselected Days

For the current week, Claude should find and fill any missing selections:

1. Run `node src/fk.js refresh` to get latest menu data
2. Run `node src/fk.js unselected` to find meals without selections
3. For each unselected meal, run `node src/fk.js options <day> <meal>` to see available options
4. Choose the best meal based on preferences in `user_preferences.txt`
5. Open tabs: `node src/fk.js open-tabs <n>` (one per unselected meal)
6. Spawn sub-agents in parallel, each handling one tab with `select-one.js`
7. Each sub-agent: discover addons, select appropriate ones, confirm
8. Close tabs: `node src/fk.js close-tabs`
9. Record with src/write-summary.js (both short summary and detailed explanation)
10. After all meals are selected, ask User if they want to close the browser

## Files

- `user_preferences.txt` - User's food preferences (cuisines, ingredients to avoid, general patterns). Only update when User asks - not a log of selections.
- `claude-tips.md` - Technical tips for using the tools
- `selections/` - Selection summaries and detailed explanations
- `tmp/api-responses/` - Cached API data (refresh with `node src/fk.js refresh`)

