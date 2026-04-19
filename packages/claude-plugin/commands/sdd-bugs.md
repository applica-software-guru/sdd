---
description: Show open bugs in the SDD project and offer to fix them
allowed-tools: Bash(sdd bug:*) Read Glob Grep
---

Run `sdd bug open` and report what it returns:

- If there are open bugs, list them by title and file path.
- Offer to fix each bug — reading the bug file, applying the fix in code or docs, then running `sdd mark-bug-resolved <bug-file>` and committing.
- If there are no open bugs, confirm and suggest running `/sdd-crs` or `/sdd-sync` next.
