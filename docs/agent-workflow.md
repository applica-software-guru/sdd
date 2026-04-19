# Using SDD with a Coding Agent

This guide shows how to use SDD with Claude Code. The same workflow applies to any coding agent (Copilot, Cursor, GPT, etc).

## Overview

SDD projects are designed to be driven by an agent. The agent reads `.sdd/skill/sdd/SKILL.md` (legacy fallback: `.claude/skills/sdd/SKILL.md`), understands the workflow, and executes `sdd` commands autonomously. You write the Story, the agent writes the code.

## Step 1: Create the project

```bash
sdd init my-project
cd my-project
```

During `sdd init`, choose one of the guided start modes to generate a bootstrap prompt (or apply it automatically). The prompt tells the agent to **ask you questions** about your project and then generate all the initial documentation.

The prompt is automatically copied to your clipboard.

## Step 2: Bootstrap the documentation

Open Claude Code (or your agent) in the project directory and paste the bootstrap prompt. The agent will:

1. Read `.sdd/skill/sdd/SKILL.md` to understand SDD
2. Ask you questions about your project (target users, main features, technical preferences)
3. Generate all the documentation files:
   - `product/vision.md` — what you're building and why
   - `product/users.md` — user personas
   - `product/features/*.md` — one file per feature
   - `system/entities.md` — data models
   - `system/architecture.md` — architecture decisions
   - `system/tech-stack.md` — technologies
   - `system/interfaces.md` — API contracts

The agent writes **only documentation**, no code yet. This is the Story.

## Step 3: Review and refine

Read through the generated docs. Edit anything that needs adjusting — add details, fix flows, clarify edge cases. The VS Code extension helps here: it auto-updates frontmatter when you save and shows file status in the sidebar.

This is the most important step. The quality of the Story determines the quality of the code.

## Step 4: Sync — let the agent implement

Tell the agent:

```
Run sdd sync and implement what it says.
```

The agent will:

1. Run `sdd cr pending` to check for change requests
2. Run `sdd sync` which outputs a structured prompt listing all pending files
3. Read each documentation file
4. Implement the code in `code/`
5. Run `sdd mark-synced` to mark files as done
6. Commit the changes

That's it. The agent follows the workflow described in `.sdd/skill/sdd/SKILL.md` autonomously.

## Step 5: Iterate

Need to change something? Don't tell the agent to modify code directly. Update the documentation:

**Option A — Edit the docs directly:**

Open a feature file, make your changes, save (the VS Code extension marks it as `changed`). Then tell the agent:

```
Run sdd sync and implement the changes.
```

**Option B — Use a Change Request:**

Create a file in `change-requests/`:

```yaml
---
title: "Add password recovery"
status: pending
author: "you"
created-at: "2025-06-15T00:00:00.000Z"
---

## Description

Add a "Forgot password" flow to the auth feature.

## Changes

- Update product/features/auth.md with password recovery flow
- Add a new entity PasswordResetToken in system/entities.md
- Add reset password endpoints in system/interfaces.md
```

Then tell the agent:

```
Run sdd cr pending and apply the change requests, then sdd sync.
```

The agent reads the CR, updates the docs, marks the CR as applied, and then syncs the code.

## Step 6: Remote recovery/update (optional)

When you need to align local state with remote updates (including pending CRs/bugs and draft content),
run this playbook with your agent:

```
Check remote config, pull remote updates, enrich all drafts, mark drafts enriched, then push pending updates.
```

The expected command sequence is:

```bash
# 1) Verify local project and remote connectivity
test -f .sdd/config.yaml && sdd remote status

# 2) Pull remote documents + CRs + bugs
sdd pull

# 3) List and enrich all draft docs/CRs/bugs with the configured coding agent
sdd drafts

# 4) Transition draft states to active states
sdd mark-drafts-enriched

# 5) Push pending/new/open updates back to remote
sdd push

# 6) Final verification
sdd remote status
```

If pull reports conflicts, resolve them before pushing. Avoid `sdd push --all` unless you explicitly want a full reseed.

For command details and draft lifecycle, see [Remote Sync](remote-sync.md).

## The full loop

```
                    ┌─────────────────────────┐
                    │    Write / update docs   │
                    │  (or create a CR)        │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     Agent: sdd sync     │
                    │  reads docs, writes code │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  Agent: sdd mark-synced  │
                    │  + git commit            │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   Review the code       │
                    │   Refine the Story      │
                    └────────────┬────────────┘
                                 │
                                 └──────────► repeat
```

## Tips

- **The Story is the source of truth.** Never ask the agent to change code without updating the docs first. The documentation should always reflect the current state of the system.
- **Be specific in your docs.** The more detail in the Story, the better the implementation. Include edge cases, validation rules, error messages.
- **Use screenshots.** If you have UX mockups, put them next to the feature doc (see [UX & Screenshots](ux-screenshots.md)). Multimodal agents will use them.
- **One feature per file.** Keep feature docs focused. It's easier for the agent to implement one thing well than to parse a giant document.
- **Review the generated docs.** After initial generation, spend time reading and refining before syncing. This is where you add your domain knowledge.
- **Visual components.** The agent reads screenshots directly from the feature doc when implementing UI. For React projects that want a side-by-side live editor, see the optional [`sdd ui launch-editor`](cli-reference.md#ui-component-editor-optional--react-only) utility.

## Agent compatibility

SDD uses the [agentskills.io](https://agentskills.io) standard format. The canonical skill file is `.sdd/skill/sdd/SKILL.md`, and `sdd adapters sync` can generate adapter files for major agents (Claude, Copilot, Cursor, Gemini, JetBrains AI, Grok, OpenCode, and universal adapters).
