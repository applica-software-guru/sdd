/** Mirrors the sdd-flow API response for documents */
export interface RemoteDocResponse {
  id: string;
  project_id: string;
  path: string;
  title: string;
  status: string;
  version: number;
  content: string;
  last_modified_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Bulk push response from POST /cli/push-docs */
export interface RemoteDocBulkResponse {
  created: number;
  updated: number;
  documents: RemoteDocResponse[];
}

/** Mirrors the sdd-flow API response for change requests */
export interface RemoteCRResponse {
  id: string;
  project_id: string;
  path: string | null;
  title: string;
  body: string;
  status: string;
  author_id: string;
  assignee_id: string | null;
  target_files: string[] | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Mirrors the sdd-flow API response for bugs */
export interface RemoteBugResponse {
  id: string;
  project_id: string;
  path: string | null;
  title: string;
  body: string;
  status: string;
  severity: string;
  author_id: string;
  assignee_id: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Bulk push response from POST /cli/push-crs */
export interface RemoteCRBulkResponse {
  created: number;
  updated: number;
  change_requests: RemoteCRResponse[];
}

/** Bulk push response from POST /cli/push-bugs */
export interface RemoteBugBulkResponse {
  created: number;
  updated: number;
  bugs: RemoteBugResponse[];
}

/** Tracks per-document remote sync state */
export interface RemoteDocState {
  remoteId: string;
  remoteVersion: number;
  localHash: string;
  lastSynced: string;
}

/** Tracks per-entity remote sync state (CRs, bugs) */
export interface RemoteEntityState {
  remoteId: string;
  localHash: string;
  lastSynced: string;
}

/** Persisted to .sdd/remote-state.json */
export interface RemoteState {
  lastPull?: string;
  lastPush?: string;
  documents: Record<string, RemoteDocState>;
  changeRequests?: Record<string, RemoteEntityState>;
  bugs?: Record<string, RemoteEntityState>;
}

/** Response from delete endpoints */
export interface RemoteDeleteResponse {
  deleted: number;
  paths: string[];
}

/** Result of a push operation */
export interface PushResult {
  created: number;
  updated: number;
  pushed: string[];
  deleted: string[];
}

/** A conflict detected during pull */
export interface PullConflict {
  path: string;
  localVersion: string;
  remoteVersion: number;
  reason: string;
}

/** Result of a pull operation */
export interface PullResult {
  created: string[];
  updated: string[];
  deleted: string[];
  conflicts: PullConflict[];
}

/** Result of a pull CRs/Bugs operation */
export interface PullEntitiesResult {
  created: number;
  updated: number;
  deleted: number;
}

/** Result of remote status check */
export interface RemoteStatusResult {
  configured: boolean;
  url: string | null;
  connected: boolean;
  localPending: number;
  remoteDocs: number;
}

/** Result of a remote project reset */
export interface RemoteResetResult {
  message: string;
  deleted_documents: number;
  deleted_change_requests: number;
  deleted_bugs: number;
  deleted_comments: number;
  deleted_notifications: number;
}
