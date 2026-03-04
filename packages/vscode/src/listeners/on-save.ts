import * as vscode from 'vscode';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

function getGitAuthor(): string {
  try {
    return execSync('git config user.email', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function storyFrontmatter(fileName: string): string {
  const title = path.basename(fileName, '.md').replace(/[-_]/g, ' ');
  const now = new Date().toISOString();
  const author = getGitAuthor();
  return `---
title: "${title}"
status: new
author: "${author}"
last-modified: "${now}"
version: "1.0"
---

`;
}

function crFrontmatter(fileName: string): string {
  const title = path.basename(fileName, '.md').replace(/[-_]/g, ' ');
  const now = new Date().toISOString();
  const author = getGitAuthor();
  return `---
title: "${title}"
status: draft
author: "${author}"
created-at: "${now}"
---

`;
}

function getSDDRoot(filePath: string): string | null {
  let dir = path.dirname(filePath);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.sdd'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function isInSDDFolder(filePath: string, sddRoot: string): 'story' | 'cr' | null {
  const rel = path.relative(sddRoot, filePath);
  if (rel.startsWith('product/') || rel.startsWith('system/')) return 'story';
  if (rel.startsWith('change-requests/')) return 'cr';
  return null;
}

export function registerOnCreateListener(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.onDidCreateFiles(async (event) => {
      for (const file of event.files) {
        if (!file.fsPath.endsWith('.md')) continue;

        const sddRoot = getSDDRoot(file.fsPath);
        if (!sddRoot) continue;

        const kind = isInSDDFolder(file.fsPath, sddRoot);
        if (!kind) continue;

        // Only add frontmatter if the file is empty
        const content = fs.readFileSync(file.fsPath, 'utf-8');
        if (content.trim().length > 0) continue;

        const header = kind === 'cr'
          ? crFrontmatter(path.basename(file.fsPath))
          : storyFrontmatter(path.basename(file.fsPath));

        const edit = new vscode.WorkspaceEdit();
        edit.insert(file, new vscode.Position(0, 0), header);
        await vscode.workspace.applyEdit(edit);

        // Open the file and place cursor after frontmatter
        const doc = await vscode.workspace.openTextDocument(file);
        const editor = await vscode.window.showTextDocument(doc);
        const lastLine = header.split('\n').length - 1;
        editor.selection = new vscode.Selection(lastLine, 0, lastLine, 0);
      }
    })
  );
}

export function registerOnSaveListener(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.onWillSaveTextDocument((event) => {
      if (event.reason !== vscode.TextDocumentSaveReason.Manual) return;

      const doc = event.document;
      if (doc.languageId !== 'markdown') return;

      // Check if file is inside an SDD project
      if (!getSDDRoot(doc.uri.fsPath)) return;

      const text = doc.getText();
      const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) return;

      const fmStart = 4; // after "---\n"
      const fmContent = fmMatch[1];
      const fmEnd = fmStart + fmContent.length;

      const edits: vscode.TextEdit[] = [];

      // Update last-modified
      const now = new Date().toISOString();
      const lmMatch = fmContent.match(/^(last-modified:\s*)"?([^"\n]*)"?/m);
      if (lmMatch) {
        const line = fmContent.substring(0, lmMatch.index).split('\n').length;
        edits.push(
          vscode.TextEdit.replace(
            new vscode.Range(line, 0, line, doc.lineAt(line).text.length),
            `last-modified: "${now}"`
          )
        );
      }

      // Bump version (patch: 1.0 → 1.1)
      const verMatch = fmContent.match(/^(version:\s*)"?(\d+\.\d+)"?/m);
      if (verMatch) {
        const [major, minor] = verMatch[2].split('.').map(Number);
        const newVersion = `${major}.${minor + 1}`;
        const line = fmContent.substring(0, verMatch.index).split('\n').length;
        edits.push(
          vscode.TextEdit.replace(
            new vscode.Range(line, 0, line, doc.lineAt(line).text.length),
            `version: "${newVersion}"`
          )
        );
      }

      // Set status back to changed if was synced
      const statusMatch = fmContent.match(/^(status:\s*)"?synced"?/m);
      if (statusMatch) {
        const line = fmContent.substring(0, statusMatch.index).split('\n').length;
        edits.push(
          vscode.TextEdit.replace(
            new vscode.Range(line, 0, line, doc.lineAt(line).text.length),
            'status: changed'
          )
        );
      }

      // Set author from git
      const authorMatch = fmContent.match(/^(author:\s*)"?"?/m);
      if (authorMatch && authorMatch[0].includes('""')) {
        try {
          const email = execSync('git config user.email', { encoding: 'utf-8' }).trim();
          if (email) {
            const line = fmContent.substring(0, authorMatch.index).split('\n').length;
            edits.push(
              vscode.TextEdit.replace(
                new vscode.Range(line, 0, line, doc.lineAt(line).text.length),
                `author: "${email}"`
              )
            );
          }
        } catch {
          // git not available, skip
        }
      }

      if (edits.length > 0) {
        event.waitUntil(Promise.resolve(edits));
      }
    })
  );
}

