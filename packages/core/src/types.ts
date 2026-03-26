export type StoryFileStatus = 'draft' | 'new' | 'changed' | 'deleted' | 'synced';

export interface StoryFrontmatter {
  title: string;
  status: StoryFileStatus;
  author: string;
  'last-modified': string;
  version: string;
}

export interface StoryFile {
  relativePath: string;
  frontmatter: StoryFrontmatter;
  body: string;
  pendingItems: PendingItem[];
  agentNotes: string | null;
  crossRefs: string[];
  hash: string;
}

export interface PendingItem {
  text: string;
  checked: boolean;
}

export interface Delta {
  hasChanges: boolean;
  files: DeltaFile[];
  diff: string;
}

export interface DeltaFile {
  relativePath: string;
  status: 'modified' | 'new' | 'deleted';
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  filePath: string;
  message: string;
  rule: string;
}

export interface StoryStatus {
  files: Array<{
    relativePath: string;
    status: StoryFileStatus;
    version: string;
    lastModified: string;
  }>;
}

export interface RemoteConfig {
  url: string;
  'api-key'?: string;
  timeout?: number;
}

export interface SDDConfig {
  description: string;
  'last-sync-commit'?: string;
  agent?: string;
  agents?: Record<string, string>;
  remote?: RemoteConfig;
}

export type ChangeRequestStatus = 'draft' | 'pending' | 'applied';

export interface ChangeRequestFrontmatter {
  title: string;
  status: ChangeRequestStatus;
  author: string;
  'created-at': string;
}

export interface ChangeRequest {
  relativePath: string;
  frontmatter: ChangeRequestFrontmatter;
  body: string;
}

export type BugStatus = 'draft' | 'open' | 'resolved';

export interface BugFrontmatter {
  title: string;
  status: BugStatus;
  author: string;
  'created-at': string;
}

export interface Bug {
  relativePath: string;
  frontmatter: BugFrontmatter;
  body: string;
}
