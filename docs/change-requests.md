# Change Requests

Change Requests (CRs) provide a structured way to request modifications to the documentation. Instead of editing docs directly, you describe *what* should change in a CR file. The agent reads the CR, applies the changes to the documentation, and then syncs the code.

## Why use Change Requests?

- **Traceability** — every change has a written request with a reason
- **Review** — CRs can be reviewed before being applied
- **Agent workflow** — the agent can process CRs autonomously: read the request, update the docs, then sync

## Creating a Change Request

Create a `.md` file in `change-requests/`:

```yaml
---
title: "Add user authentication"
status: draft
author: "you@email.com"
created-at: "2025-01-15T00:00:00.000Z"
---

## Description

Add JWT-based authentication to the API.

## Changes

- Create `product/features/auth.md` with login/logout/register flows
- Update `system/entities.md` to add User and Session entities
- Update `system/interfaces.md` with auth API endpoints
```

### Frontmatter

| Field | Description |
|-------|-------------|
| `title` | What this change request is about |
| `status` | `draft` (pending) or `applied` (processed) |
| `author` | Who created the request |
| `created-at` | When it was created |

## Workflow

```
1. Create a CR in change-requests/
2. sdd cr pending → agent reads pending CRs
3. Agent updates the documentation files
4. sdd mark-cr-applied → CR marked as applied
5. sdd sync → agent implements the code
```

### Commands

```bash
# See all change requests
sdd cr list

# See only draft CRs (what needs to be processed)
sdd cr pending

# Mark CRs as applied after updating docs
sdd mark-cr-applied change-requests/CR-001.md

# Mark all draft CRs as applied
sdd mark-cr-applied
```

## Naming convention

There's no enforced naming convention. Use whatever makes sense:

```
change-requests/
  CR-001-add-auth.md
  CR-002-fix-navigation.md
  add-dark-mode.md
```
