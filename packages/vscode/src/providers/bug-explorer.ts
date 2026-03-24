import * as vscode from 'vscode';
import { SDD, type Bug } from '@applica-software-guru/sdd-core';

class BugTreeItem extends vscode.TreeItem {
  constructor(
    public readonly bug: Bug | null,
    public readonly groupStatus: string | null
  ) {
    super(
      groupStatus ? groupStatus : bug!.frontmatter.title || bug!.relativePath,
      groupStatus
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );

    if (!groupStatus && bug) {
      this.description = bug.relativePath;
      this.contextValue = bug.frontmatter.status;
      this.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [
          vscode.Uri.joinPath(
            vscode.workspace.workspaceFolders![0].uri,
            bug.relativePath
          ),
        ],
      };
      this.iconPath = this.getIcon();
    }
  }

  private getIcon(): vscode.ThemeIcon {
    if (this.bug?.frontmatter.status === 'resolved') {
      return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
    }
    return new vscode.ThemeIcon('bug', new vscode.ThemeColor('charts.yellow'));
  }
}

export class BugExplorerProvider implements vscode.TreeDataProvider<BugTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BugTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private groups: Map<string, Bug[]> = new Map();

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async getChildren(element?: BugTreeItem): Promise<BugTreeItem[]> {
    if (!vscode.workspace.workspaceFolders) return [];

    if (!element) {
      const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const sdd = new SDD({ root });
      try {
        const bugs = await sdd.bugs();
        this.groups.clear();
        for (const bug of bugs) {
          const group = this.groups.get(bug.frontmatter.status) ?? [];
          group.push(bug);
          this.groups.set(bug.frontmatter.status, group);
        }
        const order = ['draft', 'open', 'resolved'];
        return order
          .filter((s) => this.groups.has(s))
          .map((s) => new BugTreeItem(null, s));
      } catch {
        return [];
      }
    }

    if (element.groupStatus) {
      const items = this.groups.get(element.groupStatus) ?? [];
      return items.map((bug) => new BugTreeItem(bug, null));
    }

    return [];
  }

  getTreeItem(element: BugTreeItem): vscode.TreeItem {
    return element;
  }
}
