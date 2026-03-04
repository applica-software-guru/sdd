export type StoryFileStatus = 'new' | 'changed' | 'deleted' | 'synced';

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
    status: 'new' | 'changed' | 'deleted' | 'synced';
    version: string;
    lastModified: string;
  }>;
}

export interface SDDConfig {
  description: string;
  'last-sync-commit'?: string;
}

export type ChangeRequestStatus = 'draft' | 'applied';

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
