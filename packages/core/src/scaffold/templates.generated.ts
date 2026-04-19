// @generated — DO NOT EDIT. Source of truth: packages/skill/
// Regenerate with: node packages/core/scripts/generate-templates.mjs

export const SKILL_MD_TEMPLATE = `---
name: sdd
description: >
  Story Driven Development workflow. Use this skill whenever working in a
  project that has \`.sdd/config.yaml\`, or when the user mentions SDD, sdd sync,
  story driven development, spec-driven development, change requests, bugs, or
  asks to implement a feature described in \`product/\` or \`system/\`. Also trigger
  on phrases like "sync the docs", "mark synced", "apply this CR", "fix this bug"
  when an SDD project is detected.
license: MIT
compatibility: Requires sdd CLI (npm i -g @applica-software-guru/sdd)
allowed-tools: Bash(sdd:*) Read Glob Grep
metadata:
  author: applica-software-guru
  version: "1.1"
---

# SDD — Story Driven Development

## What this is

SDD keeps documentation (\`product/\`, \`system/\`) and code (\`code/\`) in sync.
Specs change → \`sdd sync\` surfaces what's pending → agent implements → \`sdd mark-synced\` commits the state → repeat.

The engine behind it is git: SDD uses \`git diff\` on the doc files to know what changed since the last sync. That's why committing immediately after every \`mark-synced\` is non-negotiable — skip a commit and the next sync will see phantom changes.

## Detection

This project uses SDD if \`.sdd/config.yaml\` exists in the project root.

## The core loop

Every session on an SDD project starts the same way — clear the backlog from highest priority down, then move new work forward:

1. **Bugs first.** Run \`sdd bug open\`. If there are open bugs, fix the code/docs and run \`sdd mark-bug-resolved\`. Bugs block everything else.

2. **Then Change Requests.** Run \`sdd cr pending\`. If there are pending CRs, apply them to the docs in \`product/\`/\`system/\` (this flips docs to \`new\`/\`changed\`/\`deleted\`), then run \`sdd mark-cr-applied\`. CRs are the intended way to modify specs — never edit docs arbitrarily to reflect user requests; turn them into CRs first if scope justifies it.

3. **Then sync.** Run \`sdd sync\`. It returns a structured prompt listing every pending file and (for \`changed\` files) the exact git diff of what changed in the spec. Read only what the prompt tells you to read.

4. **Implement.** Write code inside \`code/\` matching what each doc describes. For \`deleted\` files, remove the corresponding code — the doc itself gets deleted automatically on mark-synced.

5. **Mark synced + commit.** This is one atomic step:

\`\`\`bash
sdd mark-synced                     # or sdd mark-synced <specific files>
git add -A && git commit -m "sdd sync: <what you implemented>"
\`\`\`

Every mark-synced MUST be followed by a commit in the same turn. No exceptions. See "Why the commit is mandatory" below.

6. **Publish (if remote configured).** If \`.sdd/config.yaml\` has a \`remote:\` section and an API key is set, remind the user they can push with \`sdd push\`.

## Why the commit is mandatory

\`sdd mark-synced\` records a snapshot of the doc files as the new sync baseline. On the next \`sdd sync\`, SDD runs \`git diff\` between HEAD and the working tree for each doc — that's how it detects what changed. If you mark-sync without committing, the diff machinery breaks: either the next sync sees nothing (false "all synced") or it re-surfaces already-implemented changes. The commit is what makes the sync loop durable.

## Available commands

- \`sdd status\` — All doc files and their state (new/changed/deleted/synced)
- \`sdd diff\` — Spec changes since last sync
- \`sdd sync\` — Structured prompt for pending files (with git diff for \`changed\`)
- \`sdd validate\` — Check for broken references and issues
- \`sdd mark-synced [files...]\` — Mark files (or all) as synced
- \`sdd cr list\` / \`sdd cr pending\` / \`sdd mark-cr-applied [files...]\`
- \`sdd bug list\` / \`sdd bug open\` / \`sdd mark-bug-resolved [files...]\`

## Rules

1. **Always commit after mark-synced, in the same turn.** This is the one rule you cannot break — see rationale above.
2. Always check bugs + CRs before sync; they take priority over new work.
3. Only implement what the sync prompt asks for. Don't wander into unrelated code.
4. All generated code goes inside \`code/\`. Nothing in \`code/\` should exist that isn't described by a doc.
5. Respect constraints in \`## Agent Notes\` sections of doc files when present.
6. Never edit files inside \`.sdd/\` manually — it's SDD's internal state.
7. If remote is configured, suggest \`sdd push\` after a successful local sync + commit.

## Project structure

- \`product/\` — What to build (vision, users, features)
- \`system/\` — How to build it (entities, architecture, tech-stack, interfaces)
- \`code/\` — All generated source code
- \`change-requests/\` — Proposed modifications to the docs
- \`bugs/\` — Bug reports
- \`.sdd/\` — Config and sync state (do not edit by hand)

## References

- [File format and status lifecycle](references/file-format.md)
- [Change Requests workflow](references/change-requests.md)
- [Bug workflow](references/bugs.md)
- [Remote pull/enrich/push workflow](../sdd-remote/SKILL.md)
`;

export const SKILL_REMOTE_MD_TEMPLATE = `---
name: sdd-remote
description: >
  Remote sync workflow for Story Driven Development. Use this skill whenever
  the user asks to pull from remote, push changes to SDD Flow, enrich drafts,
  update local state from remote, publish local updates, process remote drafts,
  or run a remote worker job (enrich or sync). Also trigger on phrases like
  "sdd pull", "sdd push", "sync with SDD Flow", "enrich this CR",
  "push the remote updates", "pull the latest specs".
license: MIT
compatibility: Requires sdd CLI (npm i -g @applica-software-guru/sdd)
allowed-tools: Bash(sdd:*) Read Glob Grep
metadata:
  author: applica-software-guru
  version: "1.2"
---

# SDD Remote — Pull, Enrich, Push

## Purpose

Synchronize local SDD docs with remote updates (from the SDD Flow server), enrich draft content,
and publish the enriched result to remote in active states.

This skill also applies when a **remote worker job** is dispatched from SDD Flow — the worker
runs these same workflows on behalf of the user.

## Detection

This workflow applies when:

- \`.sdd/config.yaml\` exists in the project root with a \`remote:\` section configured
- The user asks to update local state from remote, pull pending CRs/bugs/docs,
  enrich drafts, or push pending remote updates
- A remote worker job prompt instructs you to follow this workflow

Before any pull/push operation, check remote configuration with \`sdd remote status\`.

## Workflows

### Enrich workflow — Change Request

Follow this sequence to enrich a draft CR:

1. Pull remote drafts:

\`\`\`bash
sdd pull --crs-only
\`\`\`

2. Generate the draft TODO list:

\`\`\`bash
sdd drafts
\`\`\`

3. Enrich the draft with technical details, acceptance criteria, edge cases, and any
   relevant information from the project documentation and comments.

4. Transition the enriched CR from \`draft\` to \`pending\`:

\`\`\`bash
sdd mark-drafts-enriched
\`\`\`

5. Push the enriched content:

\`\`\`bash
sdd push
\`\`\`

### Enrich workflow — Document

Follow this sequence to enrich a document (e.g. a feature spec):

1. Pull remote drafts:

\`\`\`bash
sdd pull --docs-only
\`\`\`

2. Locate the document file in \`product/\` or \`system/\` and update its content with the
   enriched version.

3. Push the enriched content:

\`\`\`bash
sdd push
\`\`\`

If the document was in \`draft\` status, it transitions to \`new\` on the server.

### Sync workflow — Project-level

Full project sync when the user asks for "the latest" or "pull everything and implement":

1. Pull the latest specs:

\`\`\`bash
sdd pull
\`\`\`

2. Run the \`sdd\` skill — it handles the full loop: open bugs, pending CRs, documentation
   sync, code implementation, mark-synced, and commit.

3. Push the local updates:

\`\`\`bash
sdd push
\`\`\`

## Rules

1. Always check remote configuration before pull/push (\`sdd remote status\`). Fail gracefully if not configured.
2. Do not use \`sdd push --all\` unless the user explicitly asks for a full reseed.
3. If pull reports conflicts, do not overwrite local files blindly. Report the conflicts and ask how to proceed.
4. Do not edit files inside \`.sdd/\` manually.
5. Keep status transitions explicit: enrich first, then \`sdd mark-drafts-enriched\`, then push.
6. **Always commit before pushing** when the sync workflow makes code changes. Push should never carry uncommitted work.

## Related commands

- \`sdd remote init\` — Configure remote for this project
- \`sdd remote status\` — Show remote config + connectivity
- \`sdd pull\` / \`sdd pull --crs-only\` / \`sdd pull --docs-only\`
- \`sdd drafts\` — List draft items to enrich
- \`sdd mark-drafts-enriched\` — Transition enriched drafts to pending
- \`sdd sync\` / \`sdd mark-synced\` — Local sync loop (see \`sdd\` skill)
- \`sdd push\` — Publish local updates to remote
`;

export const FILE_FORMAT_REFERENCE = `# File Format and Status Lifecycle

## YAML Frontmatter

Every \`.md\` file in \`product/\` and \`system/\` must start with this YAML frontmatter:

\`\`\`yaml
---
title: "File title"
status: new
author: ""
last-modified: "2025-01-01T00:00:00.000Z"
version: "1.0"
---
\`\`\`

## Status values

- **\`new\`** — new file, needs to be implemented
- **\`changed\`** — modified since last sync, code needs updating
- **\`deleted\`** — feature to be removed, agent should delete related code
- **\`synced\`** — already implemented, up to date

## Version

Patch-bump on each edit: 1.0 → 1.1 → 1.2

## Last-modified

ISO 8601 datetime, updated on each edit.

## How sync works

\`sdd sync\` generates a structured prompt for the agent based on pending files:

- **\`new\` files**: the agent reads the full documentation and implements it from scratch
- **\`changed\` files**: SDD uses \`git diff\` to compute what changed in the documentation since the last commit, and includes the diff in the sync prompt — this way the agent sees exactly what was modified and can update only the affected code
- **\`deleted\` files**: the agent removes the related code

This is why **committing after every mark-synced is mandatory** — the git history is what SDD uses to detect changes.

## UX and screenshots

When a feature has UX mockups or screenshots, place them next to the feature doc:

- **Simple feature** (no screenshots): \`product/features/auth.md\`
- **Feature with screenshots**: use a folder with \`index.md\`:

\`\`\`
product/features/auth/
  index.md          ← feature doc
  login.png         ← screenshot
  register.png      ← screenshot
\`\`\`

Reference images in the markdown with relative paths:

\`\`\`markdown
## UX

![Login screen](login.png)
![Register screen](register.png)
\`\`\`

Both formats work — use a folder only when you have screenshots or multiple files for a feature.
`;

export const CHANGE_REQUESTS_REFERENCE = `# Change Requests

Change Requests (CRs) are markdown files in \`change-requests/\` that describe modifications to the documentation.

## CR format

\`\`\`yaml
---
title: "Add authentication feature"
status: draft
author: "user"
created-at: "2025-01-01T00:00:00.000Z"
---
\`\`\`

- **status**: \`draft\` (pending) or \`applied\` (already processed)
- **status**: \`draft\` (needs enrichment), \`pending\` (ready to process), or \`applied\` (already processed)

## CR workflow

1. Check for pending CRs: \`sdd cr pending\`
2. Read each pending CR and apply the described changes to the documentation files (marking them as \`new\`, \`changed\`, or \`deleted\`)
3. After applying a CR to the docs, mark it: \`sdd mark-cr-applied change-requests/CR-001.md\`
4. Then run \`sdd sync\` to implement the code changes

## CR commands

- \`sdd cr list\` — See all change requests and their status
- \`sdd cr pending\` — Show only pending CRs to process
- \`sdd mark-cr-applied [files...]\` — Mark CRs as applied after updating the docs
`;

export const BUGS_REFERENCE = `# Bugs

Bugs are markdown files in \`bugs/\` that describe problems found in the codebase.

## Bug format

\`\`\`yaml
---
title: "Login fails with empty password"
status: open
author: "user"
created-at: "2025-01-01T00:00:00.000Z"
---
\`\`\`

- **status**: \`draft\` (needs enrichment), \`open\` (needs fixing), or \`resolved\` (already fixed)

## Bug workflow

1. Check for open bugs: \`sdd bug open\`
2. Read each open bug and fix the code and/or documentation
3. After fixing a bug, mark it: \`sdd mark-bug-resolved bugs/BUG-001.md\`
4. Commit the fix

## Bug commands

- \`sdd bug list\` — See all bugs and their status
- \`sdd bug open\` — Show only open bugs to fix
- \`sdd mark-bug-resolved [files...]\` — Mark bugs as resolved after fixing
`;
