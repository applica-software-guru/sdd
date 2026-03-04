import * as vscode from 'vscode';
import { SDD, type StoryStatus } from '@applica-software-guru/sdd-core';

interface StoryItem {
  relativePath: string;
  status: string;
  version: string;
}

class StoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly story: StoryItem,
    private isGroupHeader: boolean = false
  ) {
    super(
      isGroupHeader ? story.status : story.relativePath,
      isGroupHeader
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );

    if (!isGroupHeader) {
      this.description = `v${story.version}`;
      this.contextValue = story.status;
      this.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [
          vscode.Uri.joinPath(
            vscode.workspace.workspaceFolders![0].uri,
            story.relativePath
          ),
        ],
      };
      this.iconPath = this.getIcon();
    }
  }

  private getIcon(): vscode.ThemeIcon {
    switch (this.story.status) {
      case 'synced':
        return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
      case 'deleted':
        return new vscode.ThemeIcon('trash', new vscode.ThemeColor('charts.red'));
      case 'new':
        return new vscode.ThemeIcon('add', new vscode.ThemeColor('charts.blue'));
      case 'changed':
      default:
        return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.yellow'));
    }
  }
}

export class StoryExplorerProvider implements vscode.TreeDataProvider<StoryTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<StoryTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private groups: Map<string, StoryItem[]> = new Map();

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async getChildren(element?: StoryTreeItem): Promise<StoryTreeItem[]> {
    if (!vscode.workspace.workspaceFolders) return [];

    if (!element) {
      // Root: load data and return group headers
      const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const sdd = new SDD({ root });
      try {
        const status = await sdd.status();
        this.groups.clear();
        for (const f of status.files) {
          const group = this.groups.get(f.status) ?? [];
          group.push(f);
          this.groups.set(f.status, group);
        }
        const order = ['new', 'changed', 'deleted', 'synced'];
        return order
          .filter((s) => this.groups.has(s))
          .map((s) => new StoryTreeItem({ relativePath: '', status: s, version: '' }, true));
      } catch {
        return [];
      }
    }

    // Children of a group header
    if (element.story.relativePath === '') {
      const items = this.groups.get(element.story.status) ?? [];
      return items.map((item) => new StoryTreeItem(item));
    }

    return [];
  }

  getTreeItem(element: StoryTreeItem): vscode.TreeItem {
    return element;
  }
}
