---
description: Show SDD project status — all doc files and their sync state
allowed-tools: Bash(sdd status)
---

Run `sdd status` and summarize the output:

- Group files by state: `new`, `changed`, `deleted`, `synced`.
- Report counts per state in a short summary.
- If there are pending files (new/changed/deleted), suggest the next step (typically `sdd sync`).
- If everything is synced, confirm the project is up to date.
