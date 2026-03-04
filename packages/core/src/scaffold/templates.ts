const now = () => new Date().toISOString();

function mdTemplate(title: string, content: string): string {
  return `---
title: "${title}"
status: new
author: ""
last-modified: "${now()}"
version: "1.0"
---

${content}
`;
}

export interface ProjectInfo {
  description: string;
}

export const AGENT_MD_TEMPLATE = `# SDD Project

This project uses **Story Driven Development (SDD)**.
Documentation drives implementation: read the docs first, then write code.

## Workflow

1. Run \`sdd cr pending\` — check if there are change requests to process first
2. If there are pending CRs, apply them to the docs, then run \`sdd mark-cr-applied\`
3. Run \`sdd sync\` to see what needs to be implemented
4. Read the documentation files listed in the sync output
5. Implement what each file describes, writing code inside \`code/\`
6. After implementing, mark files as synced:

\`\`\`
sdd mark-synced product/features/auth.md
\`\`\`

Or mark all pending files at once:

\`\`\`
sdd mark-synced
\`\`\`

7. **Commit immediately after mark-synced** — this is mandatory:

\`\`\`
git add -A && git commit -m "sdd sync: <brief description of what was implemented>"
\`\`\`

Do NOT skip this step. Every mark-synced must be followed by a git commit.

### Removing a feature

If a documentation file has \`status: deleted\`, it means that feature should be removed.
Delete the related code in \`code/\`, then run \`sdd mark-synced <file>\` (the doc file will be removed automatically), then commit.

## Available commands

- \`sdd status\` — See all documentation files and their state (new/changed/deleted/synced)
- \`sdd diff\` — See what changed since last sync
- \`sdd sync\` — Get the sync prompt for pending files (new/changed/deleted)
- \`sdd validate\` — Check for broken references and issues
- \`sdd mark-synced [files...]\` — Mark specific files (or all) as synced
- \`sdd cr list\` — List all change requests with their status
- \`sdd cr pending\` — Show draft change requests to process
- \`sdd mark-cr-applied [files...]\` — Mark change requests as applied

## Rules

1. **Always commit after mark-synced** — run \`git add -A && git commit -m "sdd sync: ..."\` immediately after \`sdd mark-synced\`. Never leave synced files uncommitted.
2. Before running \`sdd sync\`, check for pending change requests with \`sdd cr pending\`
3. If there are pending CRs, apply them to the docs first, then mark them with \`sdd mark-cr-applied\`
4. Only implement what the sync prompt asks for
5. All generated code goes inside \`code/\`
6. Respect all constraints in \`## Agent Notes\` sections (if present)
7. Do not edit files inside \`.sdd/\` manually

## File format

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

- **status**: one of:
  - \`new\` — new file, needs to be implemented
  - \`changed\` — modified since last sync, code needs updating
  - \`deleted\` — feature to be removed, agent should delete related code
  - \`synced\` — already implemented, up to date
- **version**: patch-bump on each edit (1.0 → 1.1 → 1.2)
- **last-modified**: ISO 8601 datetime, updated on each edit

## Change Requests

Change Requests (CRs) are markdown files in \`change-requests/\` that describe modifications to the documentation.

### CR format

\`\`\`yaml
---
title: "Add authentication feature"
status: draft
author: "user"
created-at: "2025-01-01T00:00:00.000Z"
---
\`\`\`

- **status**: \`draft\` (pending) or \`applied\` (already processed)

### CR workflow

1. Check for pending CRs: \`sdd cr pending\`
2. Read each pending CR and apply the described changes to the documentation files (marking them as \`new\`, \`changed\`, or \`deleted\`)
3. After applying a CR to the docs, mark it: \`sdd mark-cr-applied change-requests/CR-001.md\`
4. Then run \`sdd sync\` to implement the code changes

### CR commands

- \`sdd cr list\` — See all change requests and their status
- \`sdd cr pending\` — Show only draft CRs to process
- \`sdd mark-cr-applied [files...]\` — Mark CRs as applied after updating the docs

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

## Project structure

- \`product/\` — What to build (vision, users, features)
- \`system/\` — How to build it (entities, architecture, tech stack, interfaces)
- \`code/\` — All generated source code goes here
- \`change-requests/\` — Change requests to the documentation
- \`.sdd/\` — Project config and sync state (do not edit)
`;

export const EMPTY_LOCK_TEMPLATE = () => `synced-at: "${new Date().toISOString()}"
files: {}
`;
