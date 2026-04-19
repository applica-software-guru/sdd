# Changelog

## 1.9.0 (2026-04-19)

### Removed

- **`sdd-ui` skill**: Removed from the Claude Code plugin, the canonical `packages/skill/` source, and from `sdd init` scaffolding (no longer written to `.claude/skills/` or `.agents/skills/` in new projects). The skill was too narrow in scope (React-only) and too fragile to distribute in the core plugin: it required Playwright MCP and a running Vite dev server just to operate. The core `sdd` skill already handles UI implementation by reading spec screenshots directly. The standalone `@applica-software-guru/sdd-ui` npm package and the `sdd ui launch-editor` CLI command remain available for React projects that want a live side-by-side editor.

### Added

- **Claude plugin slash commands**: `/sdd-status`, `/sdd-sync`, `/sdd-bugs`, `/sdd-crs`, `/sdd-pull`, `/sdd-push`. Explicit, one-shot entry points that complement the auto-triggered skills.
- **Claude plugin SessionStart hook**: On session start in an SDD project, the plugin runs a lightweight check and surfaces pending doc files, open bugs, and pending CRs. Silent when not in an SDD project or when the `sdd` CLI isn't available.

### Changed

- **`sdd` skill**: Clearer description with more triggering phrases to reduce undertriggering. Deduplicated the commit rule (now explained once, with explicit rationale about why the git-diff machinery depends on it). Bumped to skill version 1.1.
- **`sdd-remote` skill**: Fixed step numbering in all three workflows (was `1, 3, 4, 5, 6`). Richer description with SDD Flow / pull / push phrases. Bumped to skill version 1.2.
- **Claude plugin version**: Bumped from 1.8.0 to 1.9.0 to align with the rest of the monorepo (was previously out of sync).
- **CLI prebuild**: Now cleans `skills/` and `claude-plugin/skills/` before copying from `packages/skill/`, so removed skills don't persist as stale files in committed outputs.

---

## 1.8.3 (2026-03-27)

### Remote Worker Daemon

Main feature of this release: the `sdd remote worker` command registers the local machine as a remote worker for **SDD Flow** and polls for AI agent jobs dispatched from the web UI.

- **Worker daemon**: registration with periodic heartbeat, concurrent job polling, AI agent execution with output batching and Q&A relay via stdin
- **Worker client API**: functions for register, heartbeat, poll, output/question/answer relay, and job completion
- **Interactive agent runner**: new `startAgent()` returning a handle with `writeStdin`/`kill`/`exitPromise` for interactive stdin piping
- **Compact colored logs**: box-drawing prefix, first-line prompt preview, exit code + changed files count in one line, color-coded log lines (yellow=error, green=done, cyan=job)

### Working Branch Enforcement

- `sdd init` now prompts for a working branch; the worker daemon runs `checkoutBranch()` automatically before each job
- Worker displays agent/model/branch/prompt on job receive

### Agent Runner Improvements

- **Stream-json output**: `--output-format stream-json` support for Claude Agent — NDJSON event parsing with clean text forwarding to stdout or callback
- **Dynamic model selection**: `$MODEL` placeholder support in the agent command for runtime model selection
- **Report section**: added to both sync and enrichment prompts to structure agent output

### Fixes

- **Document status in push payload**: the frontmatter `status` field is now included in the push payload (previously all documents were stored as "synced")
- **Bootstrap prompt uses skill name**: prompts now reference the skill by name (`sdd`) instead of hardcoded file paths, matching how agents discover and invoke skills

### Documentation

- New `docs/remote-worker.md` guide with worker lifecycle, options, and job types
- Updated `docs/README.md` with a complete documentation index
- Added draft lifecycle (draft → pending/open) to `docs/concepts.md`
- Updated `docs/cli-reference.md` and `docs/remote-sync.md`

### Cleanup

- Removed `branch-guard.ts` and related unused exports
- Removed "apply" job type from prompts and `sdd-remote` skill
- Updated `sdd-remote` skill with correct paths and revised sync workflow

---

## 1.8.2 (2026-03-24)

### Removed

- **`sdd apply` command**: Removed entirely from CLI, core, VS Code, tests, docs, and skills. Agent-driven apply workflows are no longer part of the toolchain.
- **VS Code `sdd.apply` and `sdd.build` commands**: Removed from the extension command palette.

### Added

- **`sdd drafts` command**: Replaces `sdd enrich-drafts`. Lists all draft documents, CRs, and bugs, then prints a minimal TODO prompt for the agent to consume. No agent invocation — designed to be called from within an agent skill.
- **`sdd-remote` skill**: New agent skill for the remote pull/enrich/push workflow. Wired into `sdd init` and `sdd adapters sync` scaffolding (`.sdd/skill/`, `.claude/skills/`, `.agents/skills/`).
- **`allowed-tools` in skill frontmatter**: Re-added `allowed-tools: Bash(sdd:*) Read Glob Grep` to all `sdd` and `sdd-remote` SKILL.md files.

### Improved

- **`sdd` skill — push reminder**: Added step 10 and rule 8 to the `sdd` skill: when remote sync is configured, the agent suggests running `sdd push` after a successful local sync + commit.
- **Draft enrichment prompt simplified**: `generateDraftEnrichmentPrompt()` now produces a minimal TODO list (file paths + titles only). Removed project description, document bodies, and project context section — the agent retrieves context itself.

### Refactored

- **`packages/skill/` as single source of truth**: Skill markdown files in `packages/skill/` are now canonical. A new build script (`packages/core/scripts/generate-templates.mjs`) reads them and generates `templates.generated.ts`. `templates.ts` is now a thin re-export wrapper.
- **CLI prebuild**: Now copies `packages/skill/` to both `cli/skills/` and `claude-plugin/skills/` in a single prebuild step.

---

## 1.8.1 (2026-03-24)

### Features

- **Claude Code plugin package**: Added `packages/claude-plugin` with marketplace-ready plugin metadata and bundled Agent Skills (`sdd` and `sdd-ui`).
- **Claude plugin documentation**: Added dedicated setup and usage guide in `docs/claude-code-plugin.md`.

### Fixes

- **CR status semantics aligned**: Updated CLI, docs, and skills to consistently treat `sdd cr pending` as pending-only (`draft -> pending -> applied`).
- **Bug resolution guardrail**: `markBugResolved()` now resolves only bugs in `open` state (draft bugs are no longer marked by mistake).
- **VS Code explorer consistency**: CR explorer now includes `pending` group, bug explorer includes `draft` group, and CR context action targets pending items.
- **Prompt/remote-state test alignment**: Updated core tests to match current prompt format and remote state schema.
- **Claude plugin skill references**: Aligned plugin skill wording with current CR/Bug lifecycle semantics.

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

## 1.0.3

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
