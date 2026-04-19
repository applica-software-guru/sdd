---
description: Push local SDD updates to the SDD Flow remote
allowed-tools: Bash(sdd:*) Bash(git status:*)
---

Publish local updates to remote:

1. `sdd remote status` — confirm remote is configured.
2. Verify the working tree is clean with `git status`. Never push uncommitted sync work — commit first.
3. `sdd push` — publish pending local updates.
4. Report what was pushed (docs, CRs, bugs).
5. Do NOT use `sdd push --all` unless the user explicitly asks for a full reseed.
