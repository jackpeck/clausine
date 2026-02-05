# Forkable Meal Selection Instructions

## Purpose

This tool helps select work meals from Forkable (a corporate meal ordering service). Claude reviews available meal options, applies User's preferences from `user_preferences.txt`, and selects the best meals for days that don't have selections yet. Each selection is documented with a short summary and detailed reasoning.

## First Run Setup


Before starting, check if `./user_preferences.txt` exists (in the repo root). If not, ask the user:
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

### 1. Check Available Options

```bash
node src/fk.js options <day> <lunch|dinner>
```

This shows all available meals for a day/meal type, along with User's preferences from `user_preferences.txt`. Claude should review the options and choose the best match.

### 2. Select a Meal

```bash
node src/fk.js lunch                    # or: node src/fk.js dinner
node src/fk.js open <day>               # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
node src/fk.js select "<meal name>"
node src/fk.js addons                   # see available options and add-ons
node src/fk.js toggle "<addon>"         # toggle addon (first match)
node src/fk.js toggle "<addon>" 2       # toggle addon in section 2 (for multiple choice groups)
node src/fk.js notes "no onion please"  # add notes if restaurant supports it
node src/fk.js price                    # verify price is under budget
node src/fk.js confirm
```

If the page shows "CHOOSE MEAL FROM:" with restaurant buttons, one must be clicked first to see the menu. The `open` command handles this automatically. Once viewing options for a specific day and time, `select` searches across all restaurants so clicking a specific restaurant button first is not required.

For meals with multiple required selections (e.g., "Choose Beef Type #1", "#2", "#3"), use the section number parameter with toggle to target specific groups.

### 3. Select Multiple Meals in Parallel (Faster)

For selecting multiple meals at once, use the multi-tab feature which opens separate browser tabs and selects all meals simultaneously:

```bash
node src/fk.js select-all '[
  {"day":0,"mealType":"Lunch","mealName":"Chicken Bowl"},
  {"day":1,"mealType":"Lunch","mealName":"Beef Tacos"},
  {"day":2,"mealType":"Lunch","mealName":"Veggie Wrap"}
]'
```

Or save selections to a JSON file and pass the path:
```bash
node src/fk.js select-all selections.json
```

Each selection object supports:
- `day` - 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
- `mealType` - "Lunch" or "Dinner"
- `mealName` - Name of the meal to select
- `addons` (optional) - Array of `{"name": "Addon Name", "section": 2}` (section is optional)

This is much faster than selecting meals one at a time, as all tabs run in parallel.

### 4. Record the Selection

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
5. Select meals using either method:
   - **Individual**: Use `open`, `select`, `toggle`, `confirm` commands one day at a time
   - **Parallel (faster)**: Use `select-all` with JSON to select multiple meals simultaneously
6. Record with src/write-summary.js (both short summary and detailed explanation)
7. After all meals are selected, ask User if they want to close the browser

## Files

- `user_preferences.txt` - User's food preferences (cuisines, ingredients to avoid, general patterns). Only update when User asks - not a log of selections.
- `claude-tips.md` - Technical tips for using the tools
- `selections/` - Selection summaries and detailed explanations
- `tmp/api-responses/` - Cached API data (refresh with `node src/fk.js refresh`)
