---
description: Show pending Change Requests in the SDD project and offer to apply them
allowed-tools: Bash(sdd cr:*) Read Glob Grep
---

Run `sdd cr pending` and report what it returns:

- If there are pending CRs, list them by title and file path.
- For each CR, read the file and summarize the proposed change. Ask the user which ones to apply.
- Apply approved CRs by editing the relevant docs in `product/`/`system/` (flipping status to `new`/`changed`/`deleted`), then run `sdd mark-cr-applied <cr-file>`.
- Remind the user that `sdd sync` runs next to implement the code changes.
- If no pending CRs, confirm and suggest `/sdd-sync`.
