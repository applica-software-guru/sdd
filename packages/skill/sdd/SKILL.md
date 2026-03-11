---
name: sdd
description: >
  Story Driven Development workflow. Use when working in a project
  with .sdd/config.yaml, or when the user mentions SDD, sdd sync,
  story driven development, or spec-driven development.
license: MIT
compatibility: Requires sdd CLI (npm i -g @applica-software-guru/sdd)
metadata:
  author: applica-software-guru
  version: "1.0"
---

# SDD — Story Driven Development

## Detection

This project uses SDD if `.sdd/config.yaml` exists in the project root.

## Workflow

Follow this loop every time you work on an SDD project:

1. Run `sdd bug open` — check if there are open bugs to fix first
2. If there are open bugs, fix the code/docs, then run `sdd mark-bug-resolved`
3. Run `sdd cr pending` — check if there are change requests to process
4. If there are pending CRs, apply them to the docs, then run `sdd mark-cr-applied`
5. Run `sdd sync` to see what needs to be implemented
6. Read the documentation files listed in the sync output
7. Implement what each file describes, writing code inside `code/`
8. After implementing, mark files as synced:

```
sdd mark-synced product/features/auth.md
```

Or mark all pending files at once:

```
sdd mark-synced
```

9. **Commit immediately after mark-synced** — this is mandatory:

```
git add -A && git commit -m "sdd sync: <brief description of what was implemented>"
```

Do NOT skip this step. Every mark-synced must be followed by a git commit.

### Removing a feature

If a documentation file has `status: deleted`, it means that feature should be removed.
Delete the related code in `code/`, then run `sdd mark-synced <file>` (the doc file will be removed automatically), then commit.

## Available commands

- `sdd status` — See all documentation files and their state (new/changed/deleted/synced)
- `sdd diff` — See what changed since last sync
- `sdd sync` — Get the sync prompt for pending files (includes git diff for changed files)
- `sdd validate` — Check for broken references and issues
- `sdd mark-synced [files...]` — Mark specific files (or all) as synced
- `sdd cr list` — List all change requests with their status
- `sdd cr pending` — Show draft change requests to process
- `sdd mark-cr-applied [files...]` — Mark change requests as applied
- `sdd bug list` — List all bugs with their status
- `sdd bug open` — Show open bugs to fix
- `sdd mark-bug-resolved [files...]` — Mark bugs as resolved

## Rules

1. **Always commit after mark-synced** — run `git add -A && git commit -m "sdd sync: ..."` immediately after `sdd mark-synced`. Never leave synced files uncommitted.
2. Before running `sdd sync`, check for open bugs with `sdd bug open` and pending change requests with `sdd cr pending`
3. If there are pending CRs, apply them to the docs first, then mark them with `sdd mark-cr-applied`
4. Only implement what the sync prompt asks for
5. All generated code goes inside `code/`
6. Respect all constraints in `## Agent Notes` sections (if present)
7. Do not edit files inside `.sdd/` manually

## Project structure

- `product/` — What to build (vision, users, features)
- `system/` — How to build it (entities, architecture, tech stack, interfaces)
- `code/` — All generated source code goes here
- `change-requests/` — Change requests to the documentation
- `bugs/` — Bug reports
- `.sdd/` — Project config and sync state (do not edit)

## Documentation format and status lifecycle

## YAML Frontmatter

Every `.md` file in `product/` and `system/` must start with this YAML frontmatter:

```yaml
---
title: "File title"
status: new
author: ""
last-modified: "2025-01-01T00:00:00.000Z"
version: "1.0"
---
```

## Status values

- **`new`** — new file, needs to be implemented
- **`changed`** — modified since last sync, code needs updating
- **`deleted`** — feature to be removed, agent should delete related code
- **`synced`** — already implemented, up to date

## Version

Patch-bump on each edit: 1.0 -> 1.1 -> 1.2

## Last-modified

ISO 8601 datetime, updated on each edit.

## How sync works

`sdd sync` generates a structured prompt for the agent based on pending files:

- **`new` files**: the agent reads the full documentation and implements it from scratch
- **`changed` files**: SDD uses `git diff` to compute what changed in the documentation since the last commit, and includes the diff in the sync prompt - this way the agent sees exactly what was modified and can update only the affected code
- **`deleted` files**: the agent removes the related code

This is why **committing after every mark-synced is mandatory** - the git history is what SDD uses to detect changes.

## UX and screenshots

When a feature has UX mockups or screenshots, place them next to the feature doc:

- **Simple feature** (no screenshots): `product/features/auth.md`
- **Feature with screenshots**: use a folder with `index.md`:

```
product/features/auth/
  index.md          <- feature doc
  login.png         <- screenshot
  register.png      <- screenshot
```

Reference images in the markdown with relative paths:

```markdown
## UX

![Login screen](login.png)
![Register screen](register.png)
```

Both formats work - use a folder only when you have screenshots or multiple files for a feature.

## Change Requests

Change Requests (CRs) are markdown files in `change-requests/` that describe modifications to the documentation.

## CR format

```yaml
---
title: "Add authentication feature"
status: draft
author: "user"
created-at: "2025-01-01T00:00:00.000Z"
---
```

- **status**: `draft` (pending) or `applied` (already processed)

## CR workflow

1. Check for pending CRs: `sdd cr pending`
2. Read each pending CR and apply the described changes to the documentation files (marking them as `new`, `changed`, or `deleted`)
3. After applying a CR to the docs, mark it: `sdd mark-cr-applied change-requests/CR-001.md`
4. Then run `sdd sync` to implement the code changes

## CR commands

- `sdd cr list` — See all change requests and their status
- `sdd cr pending` — Show only draft CRs to process
- `sdd mark-cr-applied [files...]` — Mark CRs as applied after updating the docs

## Bugs

Bugs are markdown files in `bugs/` that describe problems found in the codebase.

## Bug format

```yaml
---
title: "Login fails with empty password"
status: open
author: "user"
created-at: "2025-01-01T00:00:00.000Z"
---
```

- **status**: `open` (needs fixing) or `resolved` (already fixed)

## Bug workflow

1. Check for open bugs: `sdd bug open`
2. Read each open bug and fix the code and/or documentation
3. After fixing a bug, mark it: `sdd mark-bug-resolved bugs/BUG-001.md`
4. Commit the fix

## Bug commands

- `sdd bug list` — See all bugs and their status
- `sdd bug open` — Show only open bugs to fix
- `sdd mark-bug-resolved [files...]` — Mark bugs as resolved after fixing
