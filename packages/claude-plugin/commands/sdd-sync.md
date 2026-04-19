---
description: Run the SDD sync loop — bugs, CRs, then implement pending docs
allowed-tools: Bash(sdd:*) Read Glob Grep
---

Execute the SDD core loop as described in the `sdd` skill:

1. `sdd bug open` — if any bugs, fix them and `sdd mark-bug-resolved`.
2. `sdd cr pending` — if any CRs, apply to docs and `sdd mark-cr-applied`.
3. `sdd sync` — read the structured prompt returned.
4. Implement what the prompt describes inside `code/`.
5. `sdd mark-synced` followed by `git add -A && git commit -m "sdd sync: ..."` in the same turn.
6. If remote is configured, suggest `sdd push` afterwards.

Always commit after mark-synced — SDD's git-diff machinery depends on it.
