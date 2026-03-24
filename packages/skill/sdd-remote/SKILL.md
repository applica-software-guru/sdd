---
name: sdd-remote
description: >
  Remote sync workflow for Story Driven Development. Use when the user asks
  to update local state from remote changes, process remote drafts, and push
  enriched items back.
license: MIT
compatibility: Requires sdd CLI (npm i -g @applica-software-guru/sdd)
allowed-tools: Bash(sdd:*) Read Glob Grep
metadata:
  author: applica-software-guru
  version: "1.0"
---

# SDD Remote - Pull, Enrich, Push

## Purpose

Use this skill to synchronize local SDD docs with remote updates, enrich draft content,
and publish the enriched result to remote in active states.

## Detection

This workflow applies when:

- `.sdd/config.yaml` exists in the project root
- The user asks to update local state from remote, pull pending CRs/bugs/docs,
  enrich drafts, or push pending remote updates

## Workflow

Follow this sequence in order:

1. Verify remote configuration

```bash
test -f .sdd/config.yaml && sdd remote status
```

If remote is not configured or disconnected, run:

```bash
sdd remote init
```

Then stop and ask the user for URL/API key if needed.

2. Pull remote updates (docs + CRs + bugs)

```bash
sdd pull
```

Optional scoped pulls:

```bash
sdd pull --docs-only
sdd pull --crs-only
sdd pull --bugs-only
```

3. Generate draft TODO list for your coding agent

```bash
sdd drafts
```

This command lists all local draft docs, CRs, and bugs and prints a minimal TODO-style prompt.
Give that prompt to your coding agent. If additional context is needed, the agent can fetch it directly from project files.

4. Transition enriched drafts to active states

```bash
sdd mark-drafts-enriched
```

This performs:

- Document: `draft -> new`
- Change Request: `draft -> pending`
- Bug: `draft -> open`

5. Push local pending updates to remote

```bash
sdd push
```

6. Verify final remote sync state

```bash
sdd remote status
```

## Rules

1. Always check remote configuration before pull/push (`sdd remote status`)
2. Do not use `sdd push --all` unless the user explicitly asks for a full reseed
3. If pull reports conflicts, do not overwrite local files blindly; report conflicts and ask how to proceed
4. Do not edit files inside `.sdd/` manually
5. Keep status transitions explicit: enrich first, then `sdd mark-drafts-enriched`, then push

## Related commands

- `sdd remote init`
- `sdd remote status`
- `sdd pull`
- `sdd drafts`
- `sdd mark-drafts-enriched`
- `sdd push`
