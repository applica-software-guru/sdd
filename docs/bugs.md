# Bugs

Bugs are markdown files in `bugs/` that describe problems found in the codebase. The agent reads open bugs, fixes the code and/or documentation, and marks them as resolved.

## Why use Bug tracking?

- **Traceability** — every bug has a written description with steps to reproduce
- **Agent workflow** — the agent can process bugs autonomously: read the bug, fix the code, mark as resolved
- **History** — resolved bugs stay in the repository as a record of what was fixed

## Creating a Bug

Create a `.md` file in `bugs/`:

```yaml
---
title: "Task due date not saved"
status: open
author: "you@email.com"
created-at: "2025-01-15T00:00:00.000Z"
---

## Description

When editing a task and setting a due date, the date is not persisted after saving.

## Steps to reproduce

1. Create a new task
2. Set a due date
3. Save the task
4. Reopen the task — due date is empty

## Expected behavior

The due date should be saved and visible when reopening the task.
```

### Frontmatter

| Field | Description |
|-------|-------------|
| `title` | Short description of the bug |
| `status` | `draft` (needs enrichment), `open` (needs fixing), or `resolved` (already fixed) |
| `author` | Who reported the bug |
| `created-at` | When it was reported |

## Workflow

```
1. Create a bug in bugs/
2. sdd bug open → agent reads open bugs
3. Agent fixes the code and/or documentation
4. sdd mark-bug-resolved → bug marked as resolved
5. Commit the fix
```

The agent should check for open bugs **before** processing change requests or running `sdd sync`.

### Commands

```bash
# See all bugs
sdd bug list

# See only open bugs (what needs to be fixed)
sdd bug open

# Mark bugs as resolved after fixing
sdd mark-bug-resolved bugs/BUG-001.md

# Mark all open bugs as resolved
sdd mark-bug-resolved
```

## Naming convention

There's no enforced naming convention. Use whatever makes sense:

```
bugs/
  BUG-001-login-crash.md
  BUG-002-missing-validation.md
  task-due-date-not-saved.md
```
