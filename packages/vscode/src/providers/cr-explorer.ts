import * as vscode from 'vscode';
import { SDD, type ChangeRequest } from '@applica-software-guru/sdd-core';

class CRTreeItem extends vscode.TreeItem {
  constructor(
    public readonly cr: ChangeRequest | null,
    public readonly groupStatus: string | null
  ) {
    super(
      groupStatus ? groupStatus : cr!.frontmatter.title || cr!.relativePath,
      groupStatus
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );

    if (!groupStatus && cr) {
      this.description = cr.relativePath;
      this.contextValue = cr.frontmatter.status;
      this.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [
          vscode.Uri.joinPath(
            vscode.workspace.workspaceFolders![0].uri,
            cr.relativePath
          ),
        ],
      };
      this.iconPath = this.getIcon();
    }
  }

  private getIcon(): vscode.ThemeIcon {
    if (this.cr?.frontmatter.status === 'applied') {
      return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
    }
    return new vscode.ThemeIcon('git-pull-request', new vscode.ThemeColor('charts.yellow'));
  }
}

export class CRExplorerProvider implements vscode.TreeDataProvider<CRTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CRTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private groups: Map<string, ChangeRequest[]> = new Map();

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async getChildren(element?: CRTreeItem): Promise<CRTreeItem[]> {
    if (!vscode.workspace.workspaceFolders) return [];

    if (!element) {
      const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const sdd = new SDD({ root });
      try {
        const crs = await sdd.changeRequests();
        this.groups.clear();
        for (const cr of crs) {
          const group = this.groups.get(cr.frontmatter.status) ?? [];
          group.push(cr);
          this.groups.set(cr.frontmatter.status, group);
        }
        const order = ['draft', 'pending', 'applied'];
        return order
          .filter((s) => this.groups.has(s))
          .map((s) => new CRTreeItem(null, s));
      } catch {
        return [];
      }
    }

    if (element.groupStatus) {
      const items = this.groups.get(element.groupStatus) ?? [];
      return items.map((cr) => new CRTreeItem(cr, null));
    }

    return [];
  }

  getTreeItem(element: CRTreeItem): vscode.TreeItem {
    return element;
  }
}
