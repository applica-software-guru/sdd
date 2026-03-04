# CLI Reference

## Project setup

### `sdd init <project-name>`

Initialize a new SDD project.

```bash
sdd init my-project
sdd init my-project --bootstrap   # generate a prompt to create initial docs
```

Creates the project directory with `.sdd/`, `product/`, `system/`, `code/`, `change-requests/`, `INSTRUCTIONS.md`, and agent pointer files.

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
- Git diff for `changed` files
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
