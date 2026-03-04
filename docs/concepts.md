# Concepts

## The Story

In SDD, the **Story** is the complete narrative of your system. It's not a single document — it's the collection of all documentation files that describe what your system does, for whom, why it exists, and how it behaves.

The Story lives in two directories:

- **`product/`** — the *what*: vision, users, features
- **`system/`** — the *how*: entities, architecture, tech stack, interfaces

The agent reads the Story and implements the code. When requirements change, you update the Story first, then the agent aligns the code.

## Status lifecycle

Every documentation file has a `status` field in its frontmatter:

```
new → synced → changed → synced → ...
                  ↓
               deleted → (file removed)
```

| Status | Meaning |
|--------|---------|
| `new` | Just created, needs to be implemented |
| `changed` | Modified since last sync, code needs updating |
| `deleted` | Feature to be removed, agent should delete related code |
| `synced` | Already implemented, up to date |

- `sdd sync` generates a prompt for all files that are **not** `synced`
- `sdd mark-synced` sets pending files to `synced`
- The VS Code extension automatically sets `synced` → `changed` when you edit and save a file

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

| Field | Description |
|-------|-------------|
| `title` | Human-readable title |
| `status` | One of: `new`, `changed`, `deleted`, `synced` |
| `author` | Who wrote/modified this file |
| `last-modified` | ISO 8601 timestamp of last edit |
| `version` | Patch-bumped on each edit (1.0 → 1.1 → 1.2) |

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
  INSTRUCTIONS.md           # agent instructions (auto-generated)
```

## Agent compatibility

`sdd init` creates pointer files for popular coding agents:

| Agent | File | Content |
|-------|------|---------|
| Claude Code | `.claude/CLAUDE.md` | Points to `INSTRUCTIONS.md` |
| GitHub Copilot | `.github/copilot-instructions.md` | Points to `INSTRUCTIONS.md` |
| Cursor | `.cursorrules` | Points to `INSTRUCTIONS.md` |

All instructions live in `INSTRUCTIONS.md` — a single source of truth.
