import * as vscode from 'vscode';
import { StoryExplorerProvider } from './providers/story-explorer.js';
import { CRExplorerProvider } from './providers/cr-explorer.js';
import { StatusBarManager } from './providers/status-bar.js';
import { applyDecorations, disposeDecorations } from './providers/decorations.js';
import { registerCommands } from './commands/index.js';
import { registerOnSaveListener, registerOnCreateListener } from './listeners/on-save.js';

export function activate(context: vscode.ExtensionContext): void {
  // Set context for when clauses
  vscode.commands.executeCommand('setContext', 'sdd:projectDetected', true);

  // Story Explorer
  const explorerProvider = new StoryExplorerProvider();
  vscode.window.registerTreeDataProvider('sdd.storyExplorer', explorerProvider);

  // CR Explorer
  const crExplorerProvider = new CRExplorerProvider();
  vscode.window.registerTreeDataProvider('sdd.crExplorer', crExplorerProvider);

  // Status bar
  const statusBar = new StatusBarManager();
  context.subscriptions.push({ dispose: () => statusBar.dispose() });
  statusBar.update();

  // Commands
  registerCommands(context);

  // Refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('sdd.refresh', () => {
      explorerProvider.refresh();
      crExplorerProvider.refresh();
      statusBar.update();
    })
  );

  // Decorations
  if (vscode.window.activeTextEditor) {
    applyDecorations(vscode.window.activeTextEditor);
  }
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) applyDecorations(editor);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        applyDecorations(editor);
      }
    })
  );

  // File lifecycle listeners
  registerOnSaveListener(context);
  registerOnCreateListener(context);

  // Refresh on file save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(() => {
      explorerProvider.refresh();
      crExplorerProvider.refresh();
      statusBar.update();
    })
  );
}

export function deactivate(): void {
  disposeDecorations();
}
