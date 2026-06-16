# Concepts

## The Story

In SDD, the **Story** is the complete narrative of your system. It's not a single document — it's the collection of all documentation files that describe what your system does, for whom, why it exists, and how it behaves.

The Story lives in two directories:

- **`product/`** — the _what_: vision, users, features
- **`system/`** — the _how_: entities, architecture, tech stack, interfaces

The agent reads the Story and implements the code. When requirements change, you update the Story first, then the agent aligns the code.

## Status lifecycle

### Documentation files (`product/` and `system/`)

```
new → synced → changed → synced → ...
                  ↓
               deleted → (file removed)
```

| Status    | Meaning                                                 |
| --------- | ------------------------------------------------------- |
| `new`     | Just created, needs to be implemented                   |
| `changed` | Modified since last sync, code needs updating           |
| `deleted` | Feature to be removed, agent should delete related code |
| `synced`  | Already implemented, up to date                         |

- `sdd sync` generates a prompt for all files that are **not** `synced`
- For `changed` files, `sdd sync` uses `git diff` to show exactly what changed in the documentation since the last commit — the agent sees the diff and updates only the affected code
- `sdd mark-synced` sets pending files to `synced`
- The VS Code extension automatically sets `synced` → `changed` when you edit and save a file
- **Committing after every mark-synced is mandatory** — the git history is what SDD uses to detect changes

### Change Requests and Bugs (`change-requests/` and `bugs/`)

Change requests and bugs start as `draft` and follow their own lifecycle:

```
draft → pending → applied    (Change Request)
draft → open → resolved      (Bug)
```

| Status    | Applies to | Meaning                                          |
| --------- | ---------- | ------------------------------------------------ |
| `draft`   | CR, Bug    | Needs enrichment before processing               |
| `pending` | CR         | Enriched and ready to be applied to docs         |
| `applied` | CR         | Change has been applied to the documentation     |
| `open`    | Bug        | Confirmed and ready to be fixed                  |
| `resolved`| Bug        | Fixed in the codebase                            |

- **Draft enrichment**: a `draft` entity has a basic description but lacks technical detail. Use `sdd drafts` to see pending drafts and `sdd mark-drafts-enriched` to transition them once enriched. With a remote worker, click **Enrich on Worker** to let an agent do this automatically.
- See [Change Requests](change-requests.md) and [Bugs](bugs.md) for complete workflow details.

### Compacting closed elements

`applied` CRs and `resolved` bugs are **terminal states**: their work has already been folded into the documentation or the codebase, so the request file itself is no longer needed for the project to stay consistent. They do, however, accumulate over time and add noise to `cr list`, `bug list`, and the agent's context.

`sdd compact` clears them out without affecting the current state of the project:

- **default (archive)** — moves them to `change-requests/archive/` and `bugs/archive/`. These subdirectories are invisible to the parsers (which glob `*.md` non-recursively), so compacted elements immediately drop out of every command and the sync prompt, while remaining on disk and in git history.
- **`--purge`** — deletes the files permanently.
- **`--dry-run`** — previews what would be compacted without touching the filesystem.

`compact` is local-only: if the project is connected to SDD Flow, the remote is unaffected (the archived files simply stop appearing in future `sdd push` runs).

```bash
sdd compact              # archive applied CRs and resolved bugs
sdd compact --dry-run    # preview only
sdd compact --purge      # delete permanently
```

Safe by design: only `applied` and `resolved` elements are touched. `draft`, `pending`, and `open` are never compacted.

### Preflight check

`applied` and `resolved` are not the only thing worth checking before declaring a project "done for now". `sdd preflight` aggregates the four signals that matter:

1. **Documentation validation** (cross-references, frontmatter)
2. **Transient docs** — `new`, `changed`, `deleted` (specs not yet implemented in code)
3. **Abandoned drafts** — docs, CRs, or bugs still in `draft`
4. **Pending CRs** and **open bugs**

It prints a single report and exits non-zero if anything is pending. It is the natural gate before `compact` (`sdd preflight && sdd compact`), before `sdd sync`, or as a CI check on a PR.

## Frontmatter

Every `.md` file in `product/` and `system/` starts with YAML frontmatter:

```yaml
---
title: "Feature Name"
status: new
author: "you@email.com"
last-modified: "2025-01-01T00:00:00.000Z"
version: "1.0"
---
```

| Field           | Description                                                              |
| --------------- | ------------------------------------------------------------------------ |
| `title`         | Human-readable title                                                     |
| `status`        | Docs: `new`, `changed`, `deleted`, `synced` — CRs/Bugs: see lifecycles above |
| `author`        | Who wrote/modified this file                  |
| `last-modified` | ISO 8601 timestamp of last edit               |
| `version`       | Patch-bumped on each edit (1.0 → 1.1 → 1.2)   |

## Optional sections

You can include special sections in your documentation:

### `## Pending Changes`

A checklist of specific items to implement:

```markdown
## Pending Changes

- [ ] Add validation to login form
- [x] Create user model
- [ ] Write API tests
```

### `## Agent Notes`

Constraints and instructions for the implementing agent:

```markdown
## Agent Notes

Do not modify existing auth logic.
Use the adapter pattern for the database layer.
```

### Cross-references

Use `[[EntityName]]` to reference entities defined in `system/entities.md`:

```markdown
The login flow creates a [[Session]] for the authenticated [[User]].
```

`sdd validate` checks that all cross-references point to existing entities.

## Project structure

```
my-project/
  .sdd/                     # config (do not edit)
    config.yaml
  product/                  # what to build
    vision.md
    users.md
    features/
      auth.md               # simple feature (single file)
      dashboard/            # feature with screenshots
        index.md
        main-view.png
  system/                   # how to build it
    entities.md
    architecture.md
    tech-stack.md
    interfaces.md
  code/                     # all generated source code
  change-requests/          # change requests
    archive/                # applied CRs (after sdd compact, invisible to commands)
  bugs/                     # bug reports
    archive/                # resolved bugs (after sdd compact, invisible to commands)
  .claude/skills/sdd/
    SKILL.md              # agent skill file (auto-generated)
```

## Agent compatibility

`sdd init` creates a canonical skill at `.sdd/skill/sdd/SKILL.md` using the [agentskills.io](https://agentskills.io) standard format, then generates adapter files for major agents. Use `sdd adapters sync` to configure adapters in existing projects.
