# Claude Code Plugin

The SDD Claude Code plugin provides two Agent Skills that guide Claude through the full Story Driven Development workflow — directly from your Claude Code session, without any manual setup.

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

## Skills

Once the plugin is active, two skills are available:

### `/sdd:sdd` — Story Driven Development workflow

The main workflow skill. Invoke it in any SDD project (one with `.sdd/config.yaml`) and Claude will:

1. Check for open bugs (`sdd bug open`)
2. Check for pending change requests (`sdd cr pending`)
3. Run `sdd sync` and implement what the documentation describes
4. Mark files as synced and commit

**Automatic activation**: Claude activates this skill automatically when it detects a `.sdd/config.yaml` file in the project, or when you mention SDD-related commands.

**Requires**: `sdd` CLI installed (`npm i -g @applica-software-guru/sdd`)

### `/sdd:sdd-ui` — Visual Component Editor

Iterative workflow for implementing React components from screenshot specs. The skill opens a split-panel editor (spec screenshot on the left, live preview on the right) and uses Playwright MCP to screenshot the preview after each edit.

**Automatic activation**: Claude activates this skill when you ask to implement a React component from a screenshot in an SDD project.

**Requires**:
- `sdd` CLI installed
- Playwright MCP configured in Claude Code settings (e.g. `@playwright/mcp`)

## How it works

The plugin installs two skill files into Claude Code:

```
skills/
├── sdd/
│   ├── SKILL.md               # main workflow instructions
│   └── references/
│       ├── file-format.md     # frontmatter and status lifecycle
│       ├── change-requests.md # CR workflow details
│       └── bugs.md            # bug workflow details
└── sdd-ui/
    └── SKILL.md               # visual component editor instructions
```

Claude reads these files to understand the full SDD workflow: status lifecycle, sync loop, commit conventions, CR and bug handling, and the visual iteration loop for UI components.

## Usage in a project

Once the plugin is installed, open any SDD project in Claude Code and run:

```
/sdd:sdd
```

Or simply tell Claude:

```
Run sdd sync and implement what's pending.
```

Claude will follow the complete workflow autonomously — reading the documentation, implementing code, marking files as synced, and committing.

For visual components:

```
/sdd:sdd-ui
```

Or:

```
Implement the LoginForm component from the screenshot in product/features/auth/login.png
```

## Related

- [Getting Started](getting-started.md) — install the CLI and create your first project
- [Agent Workflow](agent-workflow.md) — full guide for using SDD with Claude Code
- [UX & Screenshots](ux-screenshots.md) — how to include mockups in your documentation
- [VS Code Extension](vscode-extension.md) — sidebar, status bar, auto-frontmatter
