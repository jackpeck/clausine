# Forkable Meal Selection Instructions

## Purpose

This tool helps select work meals from Forkable (a corporate meal ordering service). Claude reviews available meal options, applies User's preferences from `meal_preferences.txt`, and selects the best meals for days that don't have selections yet. Each selection is documented with a short summary and detailed reasoning.

## First Run Setup

Before starting, check if `meal_preferences.txt` exists. If not, ask the user:
1. Any ingredients to avoid? (allergies, dislikes)
2. Favorite cuisines or types of food?
3. Any restaurants or dishes they already know they like/dislike?

Create `meal_preferences.txt` with their answers. Budget is always $25/meal.

## Starting the Browser

```bash
./start-browser-background.sh
./wait-for-browser-ready.sh
```

This opens a Chromium browser with a persistent session. On the first run, User must log in to https://forkable.com/mc/ manually. Session cookies are persisted in `.session/` so future runs won't require login.

To stop the browser:
```bash
./stop-browser.sh
```

## Refreshing Data

Before selecting meals, Claude should refresh the API data to get the latest menu options:

```bash
node fk.js refresh
```

This captures GraphQL responses and regenerates `menus.md` with current availability.

## Selecting Meals

### 1. Check Available Options

```bash
node fk.js options <day> <lunch|dinner>
```

This shows all available meals for a day/meal type, along with User's preferences from `meal_preferences.txt`. Claude should review the options and choose the best match.

### 2. Select a Meal

```bash
node fk.js lunch                    # or: node fk.js dinner
node fk.js open <day>               # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
node fk.js select "<meal name>"
node fk.js addons                   # see available options and add-ons
node fk.js toggle "<addon>"         # toggle addon (first match)
node fk.js toggle "<addon>" 2       # toggle addon in section 2 (for multiple choice groups)
node fk.js notes "no onion please"  # add notes if restaurant supports it
node fk.js price                    # verify price is under budget
node fk.js confirm
```

If the page shows "CHOOSE MEAL FROM:" with restaurant buttons, one must be clicked first to see the menu. The `open` command handles this automatically. Once viewing options for a specific day and time, `select` searches across all restaurants so clicking a specific restaurant button first is not required.

For meals with multiple required selections (e.g., "Choose Beef Type #1", "#2", "#3"), use the section number parameter with toggle to target specific groups.

### 3. Record the Selection

Claude should always record both a short summary and a detailed explanation. Write the detailed markdown to a file first, then:

```bash
node write-summary.js <day> <mealType> "<restaurant>" "<meal>" "<description>" '<price>' "<why>" '<addon1>' '<addon2>' --detail <detail-file>
```

- `<day>` - Use day names: mon, tue, wed, thu, fri (not numbers like fk.js)
- `<price>` - Use single quotes or omit $ to avoid shell expansion (e.g., `'22.00'` or `'$22.00'`)
- `<addon>` - Format as `'Name (+6.00)'` - script will normalize to `Name (+$6.00)`
- `<why>` - One sentence explaining why this meal was picked
- `<detail-file>` - Path to markdown file with full analysis of options considered, constraints applied, and reasoning

## Task: Select Meals for Unselected Days

For the current week, Claude should find and fill any missing selections:

1. Run `node fk.js refresh` to get latest menu data
2. Run `node fk.js unselected` to find meals without selections
3. For each unselected meal, run `node fk.js options <day> <meal>` to see available options
3. Choose the best meal based on preferences in `meal_preferences.txt`
4. Select the meal and appropriate add-ons
5. Confirm the selection
6. Record with write-summary.js (both short summary and detailed explanation)
7. After all meals are selected, ask User if they want to close the browser

## Files

- `meal_preferences.txt` - User's food preferences (cuisines, ingredients to avoid, general patterns). Only update when User asks - not a log of selections.
- `claude-tips.md` - Technical tips for using the tools
- `selections/` - Selection summaries and detailed explanations
- `api-responses/` - Cached API data (refresh with `node fk.js refresh`)
