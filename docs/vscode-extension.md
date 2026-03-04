# VS Code Extension

The `sdd-vscode` extension integrates SDD into VS Code with a sidebar, status bar, automatic frontmatter management, and syntax decorations.

## Installation

### From source (development)

```bash
ln -s /path/to/sdd/packages/vscode ~/.vscode/extensions/sdd-vscode
```

Then reload VS Code (`Ctrl+Shift+P` → "Developer: Reload Window").

## Activation

The extension activates automatically when it detects a `.sdd/config.yaml` file in the workspace.

## Features

### Sidebar

The SDD icon in the activity bar opens two panels:

- **Story Explorer** — all documentation files grouped by status (`new`, `changed`, `deleted`, `synced`). Click a file to open it.
- **Change Requests** — all CRs grouped by status (`draft`, `applied`). Click to open.

Right-click context menus:
- On pending story files → "Mark Synced"
- On draft CRs → "Mark CR Applied"

### Status Bar

Bottom-left shows:
- `SDD · 3 pending · 1 CR` — when there are files to process
- `SDD ✓ all synced` — when everything is up to date

Click it to run `sdd sync`.

### Auto-update frontmatter

When you save a `.md` file inside an SDD project:

- **`last-modified`** is updated to the current timestamp
- **`version`** is bumped (1.0 → 1.1 → 1.2)
- **`status`** changes from `synced` to `changed` (so SDD knows you modified it)
- **`author`** is filled from `git config user.email` if empty

### Auto-create frontmatter

When you create a new `.md` file in `product/`, `system/`, or `change-requests/`:

- The correct frontmatter is inserted automatically (story frontmatter or CR frontmatter)
- The file opens with the cursor positioned after the frontmatter, ready to write

### Syntax decorations

In markdown files:
- **Yellow left border** on `## Pending Changes` section
- **Red left border** on `## Agent Notes` section
- **Underlined blue** on `[[cross-references]]` with hover tooltip

### Commands

All commands available via `Ctrl+Shift+P`:

| Command | Action |
|---------|--------|
| SDD: Sync | Run `sdd sync` in terminal |
| SDD: Status | Run `sdd status` in terminal |
| SDD: Validate | Run `sdd validate` in terminal |
| SDD: Mark Synced | Run `sdd mark-synced` in terminal |
| SDD: CR List | Run `sdd cr list` in terminal |
| SDD: CR Pending | Run `sdd cr pending` in terminal |
| SDD: Mark CR Applied | Run `sdd mark-cr-applied` in terminal |

## Recommended settings

If you use Prettier or another markdown formatter, disable format-on-save for markdown to avoid conflicts with the YAML frontmatter:

```json
// .vscode/settings.json
{
  "[markdown]": {
    "editor.formatOnSave": false
  }
}
```
