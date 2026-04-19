---
description: Pull the latest specs from the SDD Flow remote
allowed-tools: Bash(sdd:*) Read
---

Check remote configuration first, then pull:

1. `sdd remote status` — confirm remote is configured.
2. `sdd pull` — fetch CRs, bugs, and docs from the server.
3. Report what was pulled (new/updated/conflicts).
4. If there are conflicts, do NOT overwrite local files blindly — surface them and ask the user how to proceed.
5. After a successful pull, suggest `/sdd-sync` to process the new items locally.
