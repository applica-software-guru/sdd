# Remote Sync

Remote sync connects your local SDD project to an [SDD Flow](https://sdd.applica.guru) instance, enabling teams to use a cloud-based source of truth for documents, change requests, and bugs.

## Configuration

### 1. Interactive setup

```bash
sdd remote init
```

This prompts for the remote URL and API key, tests the connection, and saves the config to `.sdd/config.yaml`.

### 2. Manual config

Add a `remote` section to `.sdd/config.yaml`:

```yaml
description: "My project"
remote:
  url: "https://sdd.applica.guru/api/v1"
  api-key: "your-api-key-here"
```

### 3. Environment variable

The `SDD_API_KEY` environment variable takes precedence over the config file. This is useful for CI/CD pipelines:

```bash
export SDD_API_KEY="sk-..."
sdd push
```

**Priority order:** `SDD_API_KEY` env var > `remote.api-key` in config.yaml

## Commands

### `sdd remote init`

Interactive setup — prompts for URL and API key, tests the connection.

### `sdd remote status`

Shows connection status, pending local files, and remote document count.

```
  Remote Status

  URL:         https://sdd.applica.guru/api/v1
  Connected:   ✓ yes
  Local pending: 3 file(s)
  Remote docs:   12
```

### `sdd push [files...]`

Push local documents to the remote. By default, only files with `status: new` or `status: changed` are pushed. After a successful push, files are marked as `status: synced`. Files with `status: draft` are pushed but **not** marked as synced — they need AI enrichment first.

```bash
# Push all pending files
sdd push

# Push specific files
sdd push product/vision.md system/entities.md
```

### `sdd pull`

Pull documents, change requests, and bugs from the remote. If a remote element has `status: draft`, it is preserved locally as draft, signaling that AI enrichment is needed.

```bash
# Pull everything (docs + CRs + bugs)
sdd pull

# Pull only documents
sdd pull --docs-only

# Pull only change requests
sdd pull --crs-only

# Pull only bugs
sdd pull --bugs-only
```

#### Conflict detection

When pulling, the sync engine detects conflicts:

- If a file exists locally and hasn't changed since the last sync, the remote version overwrites it safely.
- If both local and remote have changed since the last sync, a **conflict** is reported and the local file is left untouched.

Conflicts are displayed in the CLI output so you can resolve them manually.

### `sdd mark-drafts-enriched [files...]`

After AI enrichment, mark draft elements as enriched. This transitions each element to its next active state:

| Element type   | From    | To        |
| -------------- | ------- | --------- |
| Document       | `draft` | `new`     |
| Change Request | `draft` | `pending` |
| Bug            | `draft` | `open`    |

```bash
# Mark all drafts as enriched
sdd mark-drafts-enriched

# Mark specific files
sdd mark-drafts-enriched product/vision.md change-requests/CR-abc123.md
```

## Draft enrichment

The `draft` state indicates human-written content that may be incomplete. When `sdd apply` detects draft elements, it includes them in the agent prompt along with full project context, so the AI can produce complete, coherent documentation.

### Draft enrichment flow

```
1. Human creates element with status: draft (locally or via SDD Flow)
2. sdd pull downloads remote drafts preserving their draft status
3. sdd apply generates a prompt including:
   a. Project description
   b. All existing non-draft documents as context
   c. Each draft element with its raw content
4. AI agent enriches the content
5. sdd mark-drafts-enriched transitions drafts to active state
6. sdd push uploads enriched content to remote
```

### Element states

**Documents:** `draft → new → changed → synced → deleted`

**Change Requests:** `draft → pending → applied`

**Bugs:** `draft → open → resolved`

## How it works

### Sync state

The file `.sdd/remote-state.json` tracks per-document sync metadata:

- `remoteId` — the document's UUID on the remote
- `remoteVersion` — the version number from the last sync
- `localHash` — SHA-256 hash of the local file at the time of last sync
- `lastSynced` — timestamp of the last sync

This file should be committed to version control so all team members share the sync state.

### Push flow

```
1. Parse all story files in the project
2. Filter to files with status != "synced" (or specific paths)
3. POST /cli/push-docs with document content
4. Update remote-state.json with new versions
5. Mark pushed files as status: synced (except drafts)
```

### Pull flow

```
1. GET /cli/pull-docs for all remote documents
2. For each document:
   a. If file doesn't exist locally → create it (preserving draft status if applicable)
   b. If remote version is newer AND local hasn't changed → overwrite
   c. If both changed → report conflict
3. GET /cli/pending-crs → create local CR files (preserving draft/pending status)
4. GET /cli/open-bugs → create local bug files (preserving draft status)
5. Update remote-state.json
```

## API endpoints used

| Endpoint                 | Method | Description                                  |
| ------------------------ | ------ | -------------------------------------------- |
| `/cli/pull-docs`         | GET    | Fetch all project documents                  |
| `/cli/push-docs`         | POST   | Push documents (create/update)               |
| `/cli/pending-crs`       | GET    | Fetch draft/pending change requests          |
| `/cli/open-bugs`         | GET    | Fetch draft/open bugs                        |
| `/cli/crs/:id/applied`   | POST   | Mark a CR as applied                         |
| `/cli/bugs/:id/resolved` | POST   | Mark a bug as resolved                       |
| `/cli/docs/:id/enriched` | POST   | Submit enriched doc content (draft → new)    |
| `/cli/crs/:id/enriched`  | POST   | Submit enriched CR content (draft → pending) |
| `/cli/bugs/:id/enriched` | POST   | Submit enriched bug content (draft → open)   |

All endpoints require `Authorization: Bearer <api-key>` header.

## Programmatic usage

The remote sync is available via the core library:

```typescript
import { SDD } from "@applica-software-guru/sdd-core";

const sdd = new SDD({ root: process.cwd() });

// Check remote status
const status = await sdd.remoteStatus();

// Push pending docs
const pushResult = await sdd.push();

// Pull everything
const pullResult = await sdd.pull();
const crs = await sdd.pullCRs();
const bugs = await sdd.pullBugs();

// Draft enrichment
const drafts = await sdd.drafts();
const enrichPrompt = await sdd.draftEnrichmentPrompt();
const enriched = await sdd.markDraftsEnriched();
```

### Lower-level API client

```typescript
import {
  buildApiConfig,
  pullDocs,
  pushDocs,
  resolveApiKey,
  markDocEnriched,
  markCREnriched,
  markBugEnriched,
} from "@applica-software-guru/sdd-core";

// resolveApiKey checks SDD_API_KEY env var first, then config
const config = buildApiConfig(sddConfig);
const docs = await pullDocs(config);

// Notify remote of enriched content
await markDocEnriched(config, docId, enrichedContent);
await markCREnriched(config, crId, enrichedBody);
await markBugEnriched(config, bugId, enrichedBody);
```
