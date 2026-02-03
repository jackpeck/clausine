---
name: order-food
description: Select meals from Forkable corporate meal ordering service
disable-model-invocation: true
allowed-tools:
  - Bash(src/check-playwright.sh)
  - Bash(src/start-browser-background.sh)
  - Bash(src/wait-for-browser-ready.sh)
  - Bash(src/stop-browser.sh)
  - Bash(npm install)
  - Bash(node src/fk.js *)
  - Bash(node src/write-summary.js *)
  - Bash(node src/browser-cmd.js *)
---

Select work meals from Forkable based on user preferences. Start browser, refresh menu data, find unselected meals, choose the best options based on `user_preferences.txt`, and confirm selections.

Read [instructions.md](../../../src/instructions.md) for detailed commands and workflow.
