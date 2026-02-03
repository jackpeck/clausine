# Tips for Claude when using Forkable

## Page Navigation
- After clicking navigation (like `a.next` for next week), the page may need time to load
- Check if the page content loaded properly before reading - empty/minimal content means still loading
- Read the page again if it looks incomplete

## Page Structure
- When viewing either Lunch or Dinner, the page shows BOTH meal types
- **First block** (Mon-Fri) = **Lunch**
- **Second block** (Mon-Fri) = **Dinner**
- This order is consistent regardless of which view (Lunch/Dinner) is selected

## Ratings
- Ratings are shown as images: `level-1.png` through `level-5.png`
- Find ratings via `.corner-link img` elements
- "Change Your Rating" = meal was rated
- "Rate Your Meal Above" = meal was NOT rated

## Week Navigation
- Use `node browser-cmd.js clicksel "a.next"` for next week
- Use `node browser-cmd.js clicksel "a.prev"` for previous week
- Week selector is at top of page in `.week-nav` element

## Meal Selection Flow
1. `node fk.js lunch` or `node fk.js dinner` - Switch to correct meal type
2. `node fk.js options <day> <meal>` - View available options (e.g., `node fk.js options wed dinner`)
3. `node fk.js open <day>` - Opens meal selection (0=Mon, 4=Fri)
4. If no meal selected, click a restaurant button to see their menu
5. `node fk.js select "<meal name>"` - Click on a meal
6. `node fk.js addons` - See available add-ons and prices
7. `node fk.js toggle "<addon>"` - Toggle an addon (chain with && for multiple)
8. `node fk.js price` - Check current price
9. `node fk.js confirm` - Confirm the selection

## Recording Selections
After confirming, record with write-summary.js:
```
node write-summary.js <day> <mealType> <restaurant> <meal> <description> <price> <why> [addons...] [--detail <file>]
```
Example:
```
node write-summary.js wed dinner "Humbowl" "Brassica" "Broccoli, cauliflower..." "$20.25" "Only option without mushrooms" "Chicken (+$1)"
```
- Summary goes to `selections/<week>.md`
- Detail file (optional) goes to `selections/<week>-<day>-<meal>-detail.md`

## Add-ons
- Usually only ONE selection allowed per section (e.g., Choose Protein)
- Don't add extras just to reach budget - only if genuinely good
- Extra protein is usually valuable (user is often hungry)
- Budget is $25 per meal

## browser-cmd.js
For direct browser interaction and debugging:
```
node browser-cmd.js read              - Read visible page text
node browser-cmd.js html              - Save full HTML to page-debug.html
node browser-cmd.js url               - Get current URL
node browser-cmd.js click <text>      - Click element by text
node browser-cmd.js clicksel <sel>    - Click by CSS selector
node browser-cmd.js goto <url>        - Navigate to URL
node browser-cmd.js screenshot [name] - Take screenshot
node browser-cmd.js eval <js>         - Run JavaScript in page
node browser-cmd.js wait <ms>         - Wait milliseconds
node browser-cmd.js back              - Go back
node browser-cmd.js reload            - Reload page
```

## Don't
- Don't use `sleep` commands
- Don't change ratings without permission
- Don't click "Change Your Rating" - it modifies the rating
- **NEVER edit files in `selections/` directly** - always use `write-summary.js`
- Write detail markdown to scratchpad/temp file first, then pass path via `--detail`
