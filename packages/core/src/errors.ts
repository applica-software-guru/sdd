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

export class RemoteError extends SDDError {
  public statusCode: number;
  constructor(statusCode: number, message: string) {
    super(`Remote error (${statusCode}): ${message}`);
    this.name = 'RemoteError';
    this.statusCode = statusCode;
  }
}

export class RemoteNotConfiguredError extends SDDError {
  constructor() {
    super('Remote not configured. Run "sdd remote init" first.');
    this.name = 'RemoteNotConfiguredError';
  }
}
