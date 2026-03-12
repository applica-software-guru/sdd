# CLI Reference

## Project setup

### `sdd init <project-name>`

Initialize a new SDD project.

```bash
sdd init my-project
```

Interactive wizard that asks:

1. Project description
2. Which agent to use (Claude Code, Codex, OpenCode, or custom)
3. How to start: write docs manually, generate bootstrap prompt, or generate and apply automatically

Creates the project directory with `.sdd/`, `product/`, `system/`, `code/`, `change-requests/`, canonical skill files in `.sdd/skill/sdd/`, and agent adapters (including `.claude/skills/sdd/SKILL.md`).

### `sdd adapters sync`

Create or update agent adapter files for projects already initialized with SDD.

```bash
# Configure all supported adapters
sdd adapters sync --all

# Configure only specific adapters
sdd adapters sync --agents claude,copilot,cursor

# Preview changes without writing files
sdd adapters sync --all --dry-run
```

Useful options:

- `--all` — configure all supported adapters
- `--agents <list>` — configure only specific adapters
- `--dry-run` — print planned changes only
- `--force` — overwrite existing adapter files when they differ

### `sdd adapters list`

List all supported adapters, their mode (`pointer` or `mirror`), and target file paths.

```bash
sdd adapters list
```

## Status & sync

### `sdd status`

Show all documentation files with their status and version.

```bash
sdd status
```

### `sdd diff`

Show files that need to be synced (status is not `synced`).

```bash
sdd diff
```

### `sdd sync`

Generate the sync prompt for all pending files. This is what you feed to your coding agent.

```bash
sdd sync
```

The output includes:

- List of files to process with their status
- `git diff` for `changed` files — shows exactly what was modified in the documentation since the last commit, so the agent can update only the affected code
- Instructions for the agent

### `sdd mark-synced [files...]`

Mark files as synced after implementation.

```bash
# Mark specific files
sdd mark-synced product/features/auth.md system/entities.md

# Mark all pending files
sdd mark-synced
```

Files with `status: deleted` are removed from disk when marked as synced.

### `sdd validate`

Check documentation for issues (broken cross-references, missing frontmatter).

```bash
sdd validate
```

## Change requests

### `sdd cr list`

List all change requests with their status (draft/applied).

```bash
sdd cr list
```

### `sdd cr pending`

Show only draft change requests. Use this to see what needs to be processed.

```bash
sdd cr pending
```

### `sdd mark-cr-applied [files...]`

Mark change requests as applied after updating the documentation.

```bash
# Mark specific CRs
sdd mark-cr-applied change-requests/CR-001.md

# Mark all draft CRs
sdd mark-cr-applied
```

## UI Component Editor

### `sdd ui launch-editor <component-name>`

Launch the split-panel UI editor: spec screenshot on the left, live React component on the right.

```bash
# Single screenshot
sdd ui launch-editor LoginForm \
  --screenshot product/features/auth/login.png

# Multiple screenshots (tabs)
sdd ui launch-editor LoginForm \
  --screenshot product/features/auth/login-desktop.png \
  --screenshot product/features/auth/login-mobile.png

# Run in background (recommended when used by an agent)
sdd ui launch-editor LoginForm \
  --screenshot product/features/auth/login.png \
  --detach
```

Options:
- `--screenshot <path>` — screenshot to show in the spec panel (repeatable)
- `--port <n>` — port for the editor (default: `5174`)
- `--detach` — run in background, terminal returns immediately; PID saved to `.sdd/ui.pid`

If the component file doesn't exist, a scaffold is created automatically at `code/components/<ComponentName>.tsx`. Vite HMR updates the preview on every save.

### `sdd ui stop`

Stop a detached UI editor.

```bash
sdd ui stop
```

Reads the PID from `.sdd/ui.pid` and sends SIGTERM. If the process was already dead, cleans up the stale file.

## Upgrade

### `sdd upgrade`

Upgrade sdd to the latest version. If run from inside an SDD project, also refreshes the skill files in `.claude/skills/`.

```bash
sdd upgrade
```

## Apply

### `sdd apply [--agent <name>]`

Run the full SDD workflow automatically using an external AI agent.
Combines: bug fixing → CR processing → sync implementation.

```bash
# Use default agent (from config or "claude")
sdd apply

# Use a specific agent
sdd apply --agent codex
```

The command generates a combined prompt with all open bugs, pending CRs, and pending files, then passes it to the selected agent for execution.

## Bugs

### `sdd bug list`

List all bugs with their status (open/resolved).

```bash
sdd bug list
```

### `sdd bug open`

Show only open bugs. Use this to see what needs to be fixed.

```bash
sdd bug open
```

### `sdd mark-bug-resolved [files...]`

Mark bugs as resolved after fixing the code/documentation.

```bash
# Mark specific bugs
sdd mark-bug-resolved bugs/BUG-001.md

# Mark all open bugs
sdd mark-bug-resolved
```
