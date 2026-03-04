# Getting Started

## Installation

```bash
npm install -g @applica-software-guru/sdd
```

## Create your first project

```bash
sdd init my-project
cd my-project
```

This creates:

```
my-project/
  .sdd/config.yaml          # project config
  .git/                     # git repo (auto-initialized)
  INSTRUCTIONS.md           # agent instructions
  .claude/CLAUDE.md         # Claude Code pointer
  .github/copilot-instructions.md  # Copilot pointer
  .cursorrules              # Cursor pointer
  product/                  # what to build
    features/
  system/                   # how to build it
  code/                     # generated source code
  change-requests/          # change requests
```

The `--bootstrap` flag generates a prompt that asks an AI agent to create the initial documentation for you:

```bash
sdd init my-project --bootstrap
```

## Write the Story

Create documentation files in `product/` and `system/`. Every `.md` file starts with YAML frontmatter:

```yaml
---
title: "User Authentication"
status: new
author: "you@email.com"
last-modified: "2025-01-01T00:00:00.000Z"
version: "1.0"
---

# User Authentication

Users can register with email/password and log in to access their dashboard.

## Flows

1. User fills in email and password
2. System validates credentials
3. System returns a JWT token
...
```

### Recommended structure

- `product/vision.md` — what you're building and why
- `product/users.md` — user personas
- `product/features/*.md` — one file per feature
- `system/entities.md` — data models (use `### Heading` per entity)
- `system/architecture.md` — architecture decisions
- `system/tech-stack.md` — technologies and frameworks
- `system/interfaces.md` — API contracts

## Let the agent work

```bash
# See what needs to be implemented
sdd sync
```

`sdd sync` outputs a structured prompt listing all pending files. Paste it into your coding agent (Claude, GPT, Copilot, Cursor) or pipe it directly.

The agent reads the documentation, implements the code in `code/`, then marks files as synced:

```bash
sdd mark-synced
```

## The workflow loop

```
1. Write/update documentation
2. sdd sync → agent implements
3. sdd mark-synced → commit
4. Repeat
```

## Bootstrap with an agent

Instead of writing all documentation manually, use `--bootstrap` to let an agent generate it:

```bash
sdd init my-project --bootstrap
cd my-project
```

This creates the project and copies a bootstrap prompt to your clipboard. Paste it into your coding agent (Claude Code, Copilot, Cursor). The agent will ask you questions about your project and generate all the initial documentation.

See [Agent Workflow](agent-workflow.md) for the complete guide.

## Next steps

- [Agent Workflow](agent-workflow.md) — full guide for using SDD with a coding agent
- [Concepts](concepts.md) — understand status lifecycle and project structure
- [CLI Reference](cli-reference.md) — all available commands
- [Change Requests](change-requests.md) — structured change management
