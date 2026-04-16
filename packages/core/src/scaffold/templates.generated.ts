// @generated — DO NOT EDIT. Source of truth: packages/skill/
// Regenerate with: node packages/core/scripts/generate-templates.mjs

export const SKILL_MD_TEMPLATE = `---
name: sdd
description: >
  Story Driven Development workflow. Use when working in a project
  with .sdd/config.yaml, or when the user mentions SDD, sdd sync,
  story driven development, or spec-driven development.
license: MIT
compatibility: Requires sdd CLI (npm i -g @applica-software-guru/sdd)
allowed-tools: Bash(sdd:*) Read Glob Grep
metadata:
  author: applica-software-guru
  version: "1.0"
---

# SDD — Story Driven Development

## Detection

This project uses SDD if \`.sdd/config.yaml\` exists in the project root.

## Workflow

Follow this loop every time you work on an SDD project:

1. Run \`sdd bug open\` — check if there are open bugs to fix first
2. If there are open bugs, fix the code/docs, then run \`sdd mark-bug-resolved\`
3. Run \`sdd cr pending\` — check if there are change requests to process
4. If there are pending CRs, apply them to the docs, then run \`sdd mark-cr-applied\`
5. Run \`sdd sync\` to see what needs to be implemented
6. Read the documentation files listed in the sync output
7. Implement what each file describes, writing code inside \`code/\`
8. After implementing, mark files as synced:

\`\`\`
sdd mark-synced product/features/auth.md
\`\`\`

Or mark all pending files at once:

\`\`\`
sdd mark-synced
\`\`\`

9. **Commit immediately after mark-synced** — this is mandatory:

\`\`\`
git add -A && git commit -m "sdd sync: <brief description of what was implemented>"
\`\`\`

Do NOT skip this step. Every mark-synced must be followed by a git commit.

10. If remote sync is configured (remote section in \`.sdd/config.yaml\` and API key available), remind the user they can publish updates with:

\`\`\`
sdd push
\`\`\`

### Removing a feature

If a documentation file has \`status: deleted\`, it means that feature should be removed.
Delete the related code in \`code/\`, then run \`sdd mark-synced <file>\` (the doc file will be removed automatically), then commit.

## Available commands

- \`sdd status\` — See all documentation files and their state (new/changed/deleted/synced)
- \`sdd diff\` — See what changed since last sync
- \`sdd sync\` — Get the sync prompt for pending files (includes git diff for changed files)
- \`sdd validate\` — Check for broken references and issues
- \`sdd mark-synced [files...]\` — Mark specific files (or all) as synced
- \`sdd cr list\` — List all change requests with their status
- \`sdd cr pending\` — Show pending change requests to process
- \`sdd mark-cr-applied [files...]\` — Mark change requests as applied
- \`sdd bug list\` — List all bugs with their status
- \`sdd bug open\` — Show open bugs to fix
- \`sdd mark-bug-resolved [files...]\` — Mark bugs as resolved

## Rules

1. **Always commit after mark-synced** — run \`git add -A && git commit -m "sdd sync: ..."\` immediately after \`sdd mark-synced\`. Never leave synced files uncommitted.
2. Before running \`sdd sync\`, check for open bugs with \`sdd bug open\` and pending change requests with \`sdd cr pending\`
3. If there are pending CRs, apply them to the docs first, then mark them with \`sdd mark-cr-applied\`
4. Only implement what the sync prompt asks for
5. All generated code goes inside \`code/\`
6. Respect all constraints in \`## Agent Notes\` sections (if present)
7. Do not edit files inside \`.sdd/\` manually
8. If remote is configured, suggest \`sdd push\` after successful local sync + commit

## Project structure

- \`product/\` — What to build (vision, users, features)
- \`system/\` — How to build it (entities, architecture, tech stack, interfaces)
- \`code/\` — All generated source code goes here
- \`change-requests/\` — Change requests to the documentation
- \`bugs/\` — Bug reports
- \`.sdd/\` — Project config and sync state (do not edit)

## References

For detailed information on specific topics, see:

- [File format and status lifecycle](references/file-format.md)
- [Change Requests workflow](references/change-requests.md)
- [Bug workflow](references/bugs.md)
- [Remote pull/enrich/push workflow](../sdd-remote/SKILL.md)
- [UI Component workflow](../sdd-ui/SKILL.md)
`;

export const SKILL_UI_MD_TEMPLATE = `---
name: sdd-ui
description: >
  UI Component Editor workflow. Use when the user wants to implement a React component
  from a screenshot in an SDD project, iterating visually with live preview.
license: MIT
compatibility: >
  Requires sdd CLI (npm i -g @applica-software-guru/sdd).
  Requires Playwright MCP configured in Claude Code
  (e.g. @playwright/mcp or @executeautomation/playwright-mcp).
allowed-tools: Bash(sdd:*) Read Glob Grep Edit Write mcp__playwright__screenshot mcp__playwright__navigate mcp__playwright__click
metadata:
  author: applica-software-guru
  version: "1.1"
---

# SDD UI — Visual Component Editor

## Purpose

Use this workflow when implementing a React component from a screenshot reference in an SDD project.
The split-panel editor shows the spec screenshot on the left and the live component on the right,
so you can iterate visually until they match.

## Prerequisites

- \`sdd\` CLI installed globally
- Playwright MCP configured in Claude Code settings
  - e.g. \`@playwright/mcp\` or \`@executeautomation/playwright-mcp\`
  - If not configured, inform the user and stop — visual feedback won't work without it

## Workflow

### Step 1 — Read the spec

Read the SDD feature file to understand what the component should look like and do.
Look for any screenshot paths referenced in the feature doc.

### Step 2 — Launch the editor

\`\`\`bash
# Single screenshot — detached (recommended when run by an agent)
sdd ui launch-editor LoginForm \\
  --screenshot product/features/auth/login.png \\
  --detach

# Multiple screenshots (e.g. desktop + mobile)
sdd ui launch-editor LoginForm \\
  --screenshot product/features/auth/login-desktop.png \\
  --screenshot product/features/auth/login-mobile.png \\
  --detach
\`\`\`

The command will:
- Scaffold \`code/components/LoginForm.tsx\` if it doesn't exist
- Print the exact component file path to edit
- Start the editor at \`http://localhost:5174\`

With \`--detach\` the process runs in background and the terminal is immediately free.
Without \`--detach\` it runs in foreground (use Ctrl+C to stop).

With multiple screenshots, the left panel shows a tab per screenshot.
With a single screenshot, no tab bar is shown.

### Step 3 — Implement the component

Edit the file printed by \`sdd ui launch-editor\` (e.g. \`code/components/LoginForm.tsx\`).

Write a React component that matches the screenshot. Use standard HTML/CSS or inline styles —
no external UI library unless the project already uses one.

Vite HMR will update the right panel automatically on every save.

### Step 4 — Visual check with Playwright

After each save, screenshot the live preview and compare it with the spec:

\`\`\`
mcp__playwright__navigate http://localhost:5174
mcp__playwright__screenshot
\`\`\`

The left panel already shows the spec screenshot for direct comparison.
Note differences in layout, spacing, typography, colors, and component structure.

### Step 5 — Iterate

Edit component → Playwright screenshot → compare → repeat until the preview matches the spec.

### Step 6 — Finalize

\`\`\`bash
sdd ui stop
sdd mark-synced product/features/auth/login.md
git add -A && git commit -m "sdd sync: implement LoginForm component"
\`\`\`

## Notes

- The component file is permanent — it lives in \`code/components/\` and is part of your project
- Port \`5174\` by default (not \`5173\`) to avoid conflicts with the user's app dev server
- If the component needs props, scaffold it with hardcoded sample data for the preview

## Troubleshooting

**Playwright MCP not configured:**
Stop and ask the user to add it to their Claude Code MCP settings before continuing.

**Component import fails in preview:**
Check that the component file has a valid default export and no TypeScript errors.

**Port already in use:**
\`sdd ui launch-editor LoginForm --screenshot login.png --port 5175\`
`;

export const SKILL_REMOTE_MD_TEMPLATE = `---
name: sdd-remote
description: >
  Remote sync workflow for Story Driven Development. Use when the user asks
  to update local state from remote changes, process remote drafts, and push
  enriched items back. Also applies when running a remote worker job (enrich
  or sync).
license: MIT
compatibility: Requires sdd CLI (npm i -g @applica-software-guru/sdd)
allowed-tools: Bash(sdd:*) Read Glob Grep
metadata:
  author: applica-software-guru
  version: "1.1"
---

# SDD Remote - Pull, Enrich, Push

## Purpose

Use this skill to synchronize local SDD docs with remote updates, enrich draft content,
and publish the enriched result to remote in active states.

This skill also applies when a **remote worker job** is dispatched from SDD Flow, as the
worker runs these same workflows on behalf of the user.

## Detection

This workflow applies when:

- \`.sdd/config.yaml\` exists in the project root
- The user asks to update local state from remote, pull pending CRs/bugs/docs,
  enrich drafts, or push pending remote updates
- A remote worker job prompt instructs you to follow this workflow

## Workflows

### Enrich Workflow (CR)

Follow this sequence to enrich a draft Change Request:

1. Pull remote updates:

\`\`\`bash
sdd pull --crs-only
\`\`\`

3. Generate draft TODO list:

\`\`\`bash
sdd drafts
\`\`\`

4. Enrich the draft with technical details, acceptance criteria, edge cases, and
   any relevant information from the project documentation and comments.

5. Transition the enriched CR to pending:

\`\`\`bash
sdd mark-drafts-enriched
\`\`\`

This performs: \`draft → pending\`

6. Push the enriched content:

\`\`\`bash
sdd push
\`\`\`

### Enrich Workflow (Document)

Follow this sequence to enrich a document:

1. Pull remote updates:

\`\`\`bash
sdd pull --docs-only
\`\`\`

3. Locate the document file in \`product/\` or \`system/\` and update its content
   with the enriched version.

4. Push the enriched content:

\`\`\`bash
sdd push
\`\`\`

If the document was in \`draft\` status, it will transition to \`new\` on the server.

### Sync Workflow (Project-level)

Follow this sequence for a full project sync (all pending items):

1. Pull the latest specs:

\`\`\`bash
sdd pull
\`\`\`

2. Run the \`sdd\` skill — it handles the full loop: open bugs, pending CRs,
   documentation sync, code implementation, mark-synced, and commit.

3. Push:

\`\`\`bash
sdd push
\`\`\`

## Rules

1. Always check remote configuration before pull/push (\`sdd remote status\`)
2. Do not use \`sdd push --all\` unless the user explicitly asks for a full reseed
3. If pull reports conflicts, do not overwrite local files blindly; report conflicts and ask how to proceed
4. Do not edit files inside \`.sdd/\` manually
5. Keep status transitions explicit: enrich first, then \`sdd mark-drafts-enriched\`, then push
6. **Always commit before pushing** when the sync workflow makes code changes

## Related commands

- \`sdd remote init\`
- \`sdd remote status\`
- \`sdd pull\`
- \`sdd drafts\`
- \`sdd mark-drafts-enriched\`
- \`sdd sync\`
- \`sdd mark-synced\`
- \`sdd push\`
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
