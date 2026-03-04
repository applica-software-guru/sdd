import type { StoryFile, ValidationResult, ValidationIssue } from '../types.js';

export function validate(files: StoryFile[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Collect known entity names from system/entities.md
  const entityNames = new Set<string>();
  const entitiesFile = files.find((f) => f.relativePath.endsWith('entities.md'));
  if (entitiesFile) {
    // Extract ### headings as entity names
    const headingRe = /^### (.+)$/gm;
    let match: RegExpExecArray | null;
    while ((match = headingRe.exec(entitiesFile.body)) !== null) {
      entityNames.add(match[1].trim());
    }
  }

  for (const file of files) {
    // Check broken cross-references
    for (const ref of file.crossRefs) {
      if (entityNames.size > 0 && !entityNames.has(ref)) {
        issues.push({
          severity: 'warning',
          filePath: file.relativePath,
          message: `Broken reference [[${ref}]] — not found in system/entities.md`,
          rule: 'broken-ref',
        });
      }
    }

    // Check frontmatter has required fields
    if (!file.frontmatter.title) {
      issues.push({
        severity: 'warning',
        filePath: file.relativePath,
        message: 'Missing "title" in frontmatter',
        rule: 'missing-frontmatter',
      });
    }
  }

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  };
}
