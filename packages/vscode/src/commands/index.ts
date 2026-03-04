import * as vscode from 'vscode';

const CLI_COMMANDS: Array<{ id: string; cliCommand: string; label: string }> = [
  { id: 'sdd.sync', cliCommand: 'sdd sync', label: 'SDD: Sync' },
  { id: 'sdd.build', cliCommand: 'sdd build', label: 'SDD: Build' },
  { id: 'sdd.status', cliCommand: 'sdd status', label: 'SDD: Status' },
  { id: 'sdd.markSynced', cliCommand: 'sdd mark-synced', label: 'SDD: Mark Synced' },
  { id: 'sdd.validate', cliCommand: 'sdd validate', label: 'SDD: Validate' },
  { id: 'sdd.crList', cliCommand: 'sdd cr list', label: 'SDD: CR List' },
  { id: 'sdd.crPending', cliCommand: 'sdd cr pending', label: 'SDD: CR Pending' },
  { id: 'sdd.markCRApplied', cliCommand: 'sdd mark-cr-applied', label: 'SDD: Mark CR Applied' },
];

export function registerCommands(context: vscode.ExtensionContext): void {
  for (const cmd of CLI_COMMANDS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(cmd.id, () => {
        const terminal =
          vscode.window.activeTerminal ??
          vscode.window.createTerminal('SDD');
        terminal.show();
        terminal.sendText(cmd.cliCommand);
      })
    );
  }
}
