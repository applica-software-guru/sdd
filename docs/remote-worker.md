# Remote Worker

The SDD remote worker connects a local machine to an [SDD Flow](https://sdd.applica.guru) instance so that AI jobs dispatched from the web UI run on a real development environment — with local toolchains, credentials, and network access.

## How it works

1. You start `sdd remote worker` on a machine that has the project checked out.
2. The worker registers itself with SDD Flow and starts polling for jobs.
3. From the SDD Flow web UI, a team member dispatches a job (Enrich, Build, or Custom) against an entity or at project level.
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

Options:

| Flag | Description |
|------|-------------|
| `--name <name>` | Worker name (defaults to hostname) |
| `--agent <agent>` | Agent to use: `claude`, `codex`, `opencode` (defaults to `claude`) |
| `--timeout <seconds>` | Job timeout in seconds (default: 1800 = 30 minutes) |

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
| `build` | Project-level | `sdd pull` → full SDD loop → `sdd push` |
| `custom` | Project-level | Executes a free-form prompt written by the user |

### Enrich

Enriches a draft entity. The generated prompt includes the current content plus all comments left by team members in SDD Flow. On completion:

| Entity type | From | To |
|-------------|------|----|
| Document | `draft` | `new` |
| Change Request | `draft` | `pending` |
| Bug | `draft` | `open` |

### Build

Project-level build. The agent runs the full SDD cycle:

```
sdd pull → fix open bugs → apply pending CRs → sdd sync → implement → commit → sdd push
```

No entity is targeted; the entire project is brought up to date.

### Custom

A free-form job where you write the entire prompt. The worker executes it as-is with no server-generated instructions. Useful for one-off tasks, experiments, or anything outside the standard SDD workflow.

## Agents and models

The worker uses the agent configured at registration time (`--agent` flag or `.sdd/config.yaml`). When SDD Flow dispatches a job, you can specify the **model** to use for that specific job; the agent binary is fixed to what the worker registered with.

Supported agent command templates — the worker substitutes `$PROMPT_FILE` and `$MODEL` at runtime:

| Agent | Default command |
|-------|----------------|
| `claude` | `claude -p "$(cat $PROMPT_FILE)" --permission-mode auto --verbose --model $MODEL` |
| `codex` | `codex -q "$(cat $PROMPT_FILE)" -m $MODEL` |
| `opencode` | `opencode -p "$(cat $PROMPT_FILE)"` |

If no model is specified for a job, the `--model` flag is removed and the agent uses its default model.

## Dispatching jobs from the UI

In SDD Flow, entities and project pages show worker action buttons when at least one worker is online:

| Button | Where | Condition |
|--------|-------|-----------|
| **Enrich on Worker** (amber) | CR / Bug / Doc detail | entity status is `draft` |
| **Build on Worker** (purple) | Workers list, Dashboard | always |
| **Custom Job** (slate) | Workers list | always |

Clicking opens the **Job Options dialog** where you select:

- **Worker** — which registered worker to send the job to (auto-selected if only one is online)
- **Model** — which model to use (optional; leave blank for the agent default)
- **Prompt** — auto-generated from the spec and comments; you can preview and edit before dispatching (Custom jobs: you write the prompt from scratch)

Job output streams in real time on the job detail page. You can answer agent questions interactively from the browser.

## Worker lifecycle

- Workers send a heartbeat every **15 seconds**
- A worker is **offline** after 60 seconds without a heartbeat
- Running jobs on a worker that has been offline for more than 5 minutes are marked **failed**
- Web UI shows: online (green), offline (gray), busy (amber)

## Viewing workers and jobs

**Workers list** (`/workers`) — shows all registered workers with their status, working branch, and agent. Buttons to dispatch Build or Custom jobs.

**Job detail page** — full streamed output in a terminal view. Live jobs show a Q&A panel for answering agent questions. Completed jobs show files changed.

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
: The worker heartbeats every 15 seconds. If the process is killed without deregistering, it shows offline after ~60 seconds.

**Agent not found**
: Make sure the agent binary is in `$PATH`. For Claude: `which claude`. For Codex: `which codex`.

**Job stuck in "queued"**
: The job is waiting for an online worker. Start a worker on a machine that has the project configured.

**Job times out**
: Default timeout is 30 minutes. Increase with `--timeout <seconds>` when starting the worker.
