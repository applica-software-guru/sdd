# Claude Code Plugin

The SDD Claude Code plugin provides Agent Skills, slash commands, and a session-start hook that guide Claude through the Story Driven Development workflow — directly from your Claude Code session, with no manual setup.

## Installation

### From the Claude Code marketplace

Search for **sdd** in the Claude Code plugin marketplace and install it.

### Manual installation

```bash
claude --plugin-dir $(npm root -g)/@applica-software-guru/sdd/claude-plugin
```

Or clone the repo and point to the local directory:

```bash
claude --plugin-dir /path/to/sdd/packages/claude-plugin
```

## What the plugin provides

### Agent Skills (auto-triggered)

Claude activates these skills automatically based on context — you rarely need to invoke them by name.

#### `sdd` — the core workflow

Triggered in any SDD project (one with `.sdd/config.yaml`), or when you mention SDD / sync / change requests / bugs / "implement this feature". Claude will:

1. Check for open bugs (`sdd bug open`)
2. Check for pending change requests (`sdd cr pending`)
3. Run `sdd sync` and implement what the docs describe
4. Mark files as synced and commit

**Requires**: `sdd` CLI installed (`npm i -g @applica-software-guru/sdd`)

#### `sdd-remote` — pull, enrich, push

Triggered when you ask to pull from remote, push to SDD Flow, enrich drafts, or run a remote worker job. The skill runs `sdd remote status` → `sdd pull` → optional enrichment → `sdd push`.

**Requires**: `sdd` CLI installed and remote configured in `.sdd/config.yaml`.

### Slash commands (explicit, one-shot)

For when you want a precise trigger rather than relying on skill activation:

| Command        | What it does                                    |
| -------------- | ----------------------------------------------- |
| `/sdd-status`  | Summarize the state of all doc files            |
| `/sdd-sync`    | Run the full sync loop (bugs → CRs → implement) |
| `/sdd-bugs`    | Show open bugs and offer to fix them            |
| `/sdd-crs`     | Show pending CRs and offer to apply them        |
| `/sdd-pull`    | Pull latest from the SDD Flow remote            |
| `/sdd-push`    | Push local updates to the SDD Flow remote       |

### SessionStart hook

When you open Claude Code in an SDD project, the plugin runs a lightweight check and surfaces the current state: pending doc files, open bugs, and pending CRs. This way you can decide whether to clear the backlog before starting new work.

The hook is silent when not in an SDD project or when the `sdd` CLI isn't installed — it never blocks the session.

## How it works

The plugin ships:

```
packages/claude-plugin/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── sdd/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── file-format.md
│   │       ├── change-requests.md
│   │       └── bugs.md
│   └── sdd-remote/
│       └── SKILL.md
├── commands/
│   ├── sdd-status.md
│   ├── sdd-sync.md
│   ├── sdd-bugs.md
│   ├── sdd-crs.md
│   ├── sdd-pull.md
│   └── sdd-push.md
└── hooks/
    ├── hooks.json
    └── scripts/
        └── sdd-session-start.sh
```

Claude reads the skill files to understand the SDD workflow (status lifecycle, sync loop, commit conventions, CR/bug handling). The slash commands and hook are wired by Claude Code directly.

## Usage

Open any SDD project in Claude Code. On session start, the hook prints a short SDD status summary. Then either:

```
Run sdd sync and implement what's pending.
```

…and Claude picks up from the `sdd` skill. Or trigger an explicit command:

```
/sdd-sync
```

For remote workflows:

```
Pull the latest specs from SDD Flow and implement them.
```

…or `/sdd-pull` followed by `/sdd-sync`.

## Note on `sdd-ui`

Earlier versions of this plugin shipped an `sdd-ui` skill for visually iterating React components with Playwright MCP. It was removed in 1.9.0 — the dependency on Playwright MCP and a running Vite server made it too fragile, and the core `sdd` skill already handles UI implementation by reading the spec screenshots directly.

The `sdd ui launch-editor` CLI command and the `@applica-software-guru/sdd-ui` npm package remain available as optional standalone tools for React projects that want a visual side-by-side editor.

## Related

- [Getting Started](getting-started.md) — install the CLI and create your first project
- [Agent Workflow](agent-workflow.md) — full guide for using SDD with Claude Code
- [UX & Screenshots](ux-screenshots.md) — how to include mockups in your documentation
- [VS Code Extension](vscode-extension.md) — sidebar, status bar, auto-frontmatter
