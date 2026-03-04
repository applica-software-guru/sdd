import * as vscode from 'vscode';
import { SDD } from '@applica-software-guru/sdd-core';

export class StatusBarManager {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'sdd.sync';
    this.item.show();
  }

  async update(): Promise<void> {
    if (!vscode.workspace.workspaceFolders) return;

    const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const sdd = new SDD({ root });
    try {
      const status = await sdd.status();
      const pendingCount = status.files.filter((f) => f.status !== 'synced').length;
      const pendingCRs = await sdd.pendingChangeRequests();
      const crCount = pendingCRs.length;

      const parts: string[] = [];
      if (pendingCount > 0) parts.push(`${pendingCount} pending`);
      if (crCount > 0) parts.push(`${crCount} CR`);

      if (parts.length > 0) {
        this.item.text = `$(book) SDD $(circle-filled) ${parts.join(' · ')}`;
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      } else {
        this.item.text = `$(book) SDD $(check) all synced`;
        this.item.backgroundColor = undefined;
      }
    } catch {
      this.item.text = '$(book) SDD';
      this.item.backgroundColor = undefined;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
