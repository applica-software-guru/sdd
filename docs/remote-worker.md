# Remote Worker

The SDD remote worker connects a local machine to an [SDD Flow](https://sdd.applica.guru) instance so that AI jobs dispatched from the web UI run on a real development environment — with local toolchains, credentials, and network access.

## How it works

1. You start `sdd remote worker` on a machine that has the project checked out.
2. The worker registers itself with SDD Flow and starts polling for jobs.
3. From the SDD Flow web UI, a team member dispatches a job (Enrich, Apply, or Sync) against a CR, bug, or document.
4. The worker picks up the job, runs the configured AI agent with the generated prompt, streams output back in real time, and reports completion or failure.

## Prerequisites

- The project must be configured with a remote: run `sdd remote init` first (see [Remote Sync](remote-sync.md)).
- The machine must have the coding agent installed (e.g. `claude`, `codex`, `opencode`).

## Branch

The worker uses whatever git branch is active when it starts — no checkout is performed. The current branch is sent to SDD Flow at registration and shown in the web UI (informational only).

SDD commands work on any branch; there is no branch restriction.

## Starting the worker

```bash
cd /path/to/project
sdd remote worker
```

The worker logs registration info and then starts polling:

```
SDD Remote Worker starting
  Registering with SDD Flow...
  Worker ID: abc123
  Polling for jobs...
```

Stop the worker at any time with `Ctrl+C`.

## Job types

| Job type | Scope | What the agent does |
|----------|-------|---------------------|
| `enrich` | Single entity (doc / CR / bug) | Enriches a draft spec, transitions it to active status |
| `apply` | Single entity (CR / bug) | Implements a CR or fixes a bug in the codebase |
| `sync` | Project-level | `sdd pull` → `sdd sync` → implement all pending → `sdd push` |

### Enrich

Enriches a draft entity. The generated prompt includes the current content plus all comments left by team members in SDD Flow. On completion:

| Entity type | From | To |
|-------------|------|----|
| Document | `draft` | `new` |
| Change Request | `draft` | `pending` |
| Bug | `draft` | `open` |

### Apply

Implements an approved change request or fixes a bug. The prompt includes the full spec and all comments. The worker runs the agent and streams output back to SDD Flow.

### Sync

Project-level sync. The agent runs the full cycle:

```
sdd pull → implement all pending specs → sdd push
```

No entity is targeted; the entire project is brought up to date.

## Agents and models

The worker uses the agent command configured via `.sdd/config.yaml` (or defaults). When SDD Flow dispatches a job, it can specify both the **agent** (Claude, Codex, OpenCode…) and the **model** to use for that specific job.

Supported agent command templates — the worker substitutes `$PROMPT_FILE` and `$MODEL` at runtime:

| Agent | Default command |
|-------|----------------|
| `claude` | `claude -p "$(cat $PROMPT_FILE)" --dangerously-skip-permissions --verbose --model $MODEL` |
| `codex` | `codex -q "$(cat $PROMPT_FILE)" -m $MODEL` |
| `opencode` | `opencode -p "$(cat $PROMPT_FILE)"` |

If no model is specified for a job, the `--model` flag is removed and the agent uses its default model.

## Dispatching jobs from the UI

In SDD Flow, any CR, bug, or document with the right status shows a worker action button:

- **Enrich on Worker** — visible when the entity is in `draft` status
- **Apply on Worker** — visible for CRs in `pending` / `approved` status, bugs in `open` status
- **Sync on Worker** — available on the Workers list and Dashboard

Clicking any of these opens the **Job Options dialog** where you can select:

- **Worker** — which registered worker to send the job to
- **Agent** — which AI agent to use (default: the agent the worker registered with)
- **Model** — which model to use (optional; leave blank for the agent default)
- **Prompt** — auto-generated from the spec and comments; you can preview and edit before dispatching

Job output streams in real time on the job detail page.

## Viewing workers and jobs

**Workers list** (`/workers`) — shows all registered workers with their status (online/offline), working branch, and registered agent.

**Worker Jobs list** (`/worker-jobs`) — shows all dispatched jobs with status (pending/running/completed/failed). Click a job to view the full streamed output.

## Configuration reference

Relevant fields in `.sdd/config.yaml`:

```yaml
# Remote connection (set by sdd remote init)
remote:
  url: "https://sdd.applica.guru/api/v1"
  api-key: "your-api-key-here"
```

## Troubleshooting

**Worker shows as offline in SDD Flow**
: The worker heartbeats every 30 seconds. If the process is killed without deregistering, it shows offline after ~60 seconds.

**Agent not found**
: Make sure the agent binary is in `$PATH`. For Claude: `which claude`. For Codex: `which codex`.

**Job stuck in "pending"**
: The job is waiting for an online worker. Start a worker on a machine that has the project configured.
