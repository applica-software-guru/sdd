export { SDD } from "./sdd.js";
export type { BranchCheckResult } from "./sdd.js";
export type {
  StoryFrontmatter,
  StoryFile,
  PendingItem,
  Delta,
  DeltaFile,
  ValidationResult,
  ValidationIssue,
  StoryStatus,
  StoryFileStatus,
  SDDConfig,
  ChangeRequest,
  ChangeRequestFrontmatter,
  ChangeRequestStatus,
  Bug,
  BugFrontmatter,
  BugStatus,
  RemoteConfig,
} from "./types.js";
export { SDDError, LockFileNotFoundError, ParseError, ProjectNotInitializedError, RemoteError, RemoteNotConfiguredError, RemoteTimeoutError } from "./errors.js";
export type { ProjectInfo } from "./scaffold/templates.js";
export { isSDDProject, readConfig, writeConfig } from "./config/config-manager.js";
export { getCurrentBranch, checkoutBranch } from "./git/git.js";
export { runAgent, startAgent } from "./agent/agent-runner.js";
export type { AgentRunnerOptions, AgentRunnerHandle } from "./agent/agent-runner.js";
export { startWorkerDaemon } from "./agent/worker-daemon.js";
export type { WorkerDaemonOptions } from "./agent/worker-daemon.js";
export { DEFAULT_AGENTS, resolveAgentCommand } from "./agent/agent-defaults.js";
export { listSupportedAdapters, SKILL_ADAPTERS, syncSkillAdapters } from "./scaffold/skill-adapters.js";
export type {
  AdapterMode,
  SkillAdapterDefinition,
  SyncAdaptersOptions,
  AdapterFileAction,
  AdapterFileChange,
  SyncAdaptersResult,
} from "./scaffold/skill-adapters.js";

// Remote sync
export { generateDraftEnrichmentPrompt } from "./prompt/draft-prompt-generator.js";
export type { DraftElements } from "./prompt/draft-prompt-generator.js";
export { resolveApiKey, buildApiConfig, pullDocs, pushDocs, pullPendingCRs, pullOpenBugs, markCRAppliedRemote, markBugResolvedRemote, markDocEnriched, markCREnriched, markBugEnriched, resetProject, DEFAULT_REMOTE_TIMEOUT } from "./remote/api-client.js";
export type { ApiClientConfig } from "./remote/api-client.js";
export { registerWorker, workerHeartbeat, workerPoll, workerJobStarted, workerJobOutput, workerJobQuestion, workerJobAnswers, workerJobCompleted } from "./remote/worker-client.js";
export type { WorkerRegistration, WorkerJobAssignment, WorkerJobAnswer, WorkerState } from "./remote/worker-types.js";
export { readRemoteState, writeRemoteState } from "./remote/state.js";
export { pushToRemote, pullFromRemote, pullCRsFromRemote, pullBugsFromRemote, getRemoteStatus, resetRemoteProject } from "./remote/sync-engine.js";
export type {
  RemoteDocResponse,
  RemoteDocBulkResponse,
  RemoteCRResponse,
  RemoteBugResponse,
  RemoteState,
  RemoteDocState,
  PushResult,
  PullResult,
  PullConflict,
  PullEntitiesResult,
  RemoteStatusResult,
  RemoteResetResult,
} from "./remote/types.js";
