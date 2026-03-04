export class SDDError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SDDError';
  }
}

export class LockFileNotFoundError extends SDDError {
  constructor(path: string) {
    super(`Lock file not found: ${path}`);
    this.name = 'LockFileNotFoundError';
  }
}

export class ParseError extends SDDError {
  constructor(filePath: string, reason: string) {
    super(`Failed to parse ${filePath}: ${reason}`);
    this.name = 'ParseError';
  }
}

export class ProjectNotInitializedError extends SDDError {
  constructor(root: string) {
    super(`No SDD project found at ${root}. Run 'sdd init' first.`);
    this.name = 'ProjectNotInitializedError';
  }
}
