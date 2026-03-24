import chalk from 'chalk';
import Table from 'cli-table3';

export function statusIcon(status: string): string {
  switch (status) {
    case 'draft':
      return chalk.magenta('◇');
    case 'synced':
      return chalk.green('✓');
    case 'new':
      return chalk.cyan('+');
    case 'changed':
      return chalk.yellow('~');
    case 'deleted':
      return chalk.red('✗');
    default:
      return chalk.gray('?');
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return chalk.magenta('draft');
    case 'synced':
      return chalk.green.bold('synced');
    case 'new':
      return chalk.cyan('new');
    case 'changed':
      return chalk.yellow('changed');
    case 'deleted':
      return chalk.red('deleted');
    default:
      return chalk.gray(status);
  }
}

export function createStatusTable(
  files: Array<{ relativePath: string; status: string; version: string; lastModified?: string }>
): string {
  const table = new Table({
    head: [
      chalk.cyan.bold(''),
      chalk.cyan.bold('File'),
      chalk.cyan.bold('Version'),
      chalk.cyan.bold('Status'),
    ],
    style: {
      head: [],
      border: ['gray'],
    },
    chars: {
      top: '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
      bottom: '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
      left: '│', 'left-mid': '├',
      mid: '─', 'mid-mid': '┼',
      right: '│', 'right-mid': '┤',
      middle: '│',
    },
  });

  for (const f of files) {
    table.push([
      statusIcon(f.status),
      chalk.white(f.relativePath),
      chalk.dim(`v${f.version}`),
      statusLabel(f.status),
    ]);
  }

  return table.toString();
}

export function heading(text: string): string {
  return '\n' + chalk.cyan.bold(`  ${text}`) + '\n';
}

export function success(text: string): string {
  return chalk.green(`  ✓ ${text}`);
}

export function warning(text: string): string {
  return chalk.yellow(`  ⚠ ${text}`);
}

export function error(text: string): string {
  return chalk.red(`  ✗ ${text}`);
}

export function info(text: string): string {
  return chalk.dim(`  ${text}`);
}

export function crStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return chalk.magenta('draft');
    case 'pending':
      return chalk.yellow('pending');
    case 'applied':
      return chalk.green('applied');
    default:
      return chalk.gray(status);
  }
}

export function bugStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return chalk.magenta('draft');
    case 'open':
      return chalk.yellow('open');
    case 'resolved':
      return chalk.green('resolved');
    default:
      return chalk.gray(status);
  }
}
