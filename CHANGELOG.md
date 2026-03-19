# Changelog

## 1.8.0 (2026-03-19)

### Features

- **Bidirectional delete sync**: `sdd push` now detects locally deleted files (docs, CRs, bugs) and propagates deletions to the remote SDD Flow platform. Files tracked in `.sdd/remote-state.json` but missing from disk are automatically deleted on remote.
- **Remote deletion pull**: `sdd pull` detects files deleted on the remote (present in local state but absent from pull response) and removes them locally. If a file was modified locally but deleted on remote, a conflict is reported instead of silently deleting.
- **Delete API client**: New `deleteDocs`, `deleteCRs`, and `deleteBugs` functions in the API client, calling the new `POST /cli/delete-docs`, `POST /cli/delete-crs`, and `POST /cli/delete-bugs` endpoints.
- **Deletion output in CLI**: Both `sdd push` and `sdd pull` now display deleted files in red and include deletion counts in the summary output.

### Types

- `PushResult` now includes a `deleted: string[]` field.
- `PullResult` now includes a `deleted: string[]` field.
- `PullEntitiesResult` now includes a `deleted: number` field.
- New `RemoteDeleteResponse` type for delete endpoint responses.

## 1.1.0 (2026-03-08)

### Features

- **Agent Skill format**: Replace `INSTRUCTIONS.md` + pointer files with a single `.claude/skills/sdd/SKILL.md` following the [agentskills.io](https://agentskills.io) standard, supported by 30+ agents.
- **Canonical skill**: Ship `packages/skill/sdd/` with `SKILL.md` and `references/` for file format, change requests, and bugs documentation.
- **`sdd init` generates skill**: Projects now get `.claude/skills/sdd/SKILL.md` + `references/*.md` instead of `INSTRUCTIONS.md`, `.claude/CLAUDE.md`, `.cursorrules`, and `.github/copilot-instructions.md`.

### Breaking Changes

- Removed `INSTRUCTIONS.md` and agent pointer files generation. Existing projects should run `sdd init` again or manually create `.claude/skills/sdd/SKILL.md`.

## 1.0.3 (2025-06-08)

- Add `sdd apply` command for applying change requests
- Bug tracking and resolution workflow
- Auto-refresh sidebar on external changes (VS Code)

## 1.0.2

- Fix build order for npm publish
- Simplify Homebrew sync flow

## 1.0.1

- Homebrew formula support
- CLI version derived from package metadata

## 1.0.0

- Initial release
