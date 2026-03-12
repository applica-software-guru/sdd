import { Command } from 'commander';
import { createRequire } from 'node:module';
import { dirname, resolve, join, basename } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import chalk from 'chalk';
import { success, info, error as fmtError } from '../ui/format.js';

const SCAFFOLD_TEMPLATE = (name: string) => `import React from 'react';

export default function ${name}() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>${name}</h1>
      <p>Start editing this component to see changes live.</p>
    </div>
  );
}
`;

const PID_FILE = '.sdd/ui.pid';

function collect(value: string, prev: string[]): string[] {
  return [...prev, value];
}

function resolveSddUiDir(): string {
  const pkgRequire = createRequire(__filename);
  try {
    return dirname(pkgRequire.resolve('@applica-software-guru/sdd-ui/package.json'));
  } catch {
    console.error(fmtError(
      'Package @applica-software-guru/sdd-ui not found.\n' +
      '  Run: npm install @applica-software-guru/sdd-ui',
    ));
    process.exit(1);
  }
}

export function registerUI(program: Command): void {
  const ui = program
    .command('ui')
    .description('UI Component Editor — visual development with live preview');

  // launch-editor
  ui
    .command('launch-editor <component-name>')
    .description('Launch the split-panel UI editor for a React component')
    .option('--screenshot <path>', 'Screenshot to show in the spec panel (repeatable)', collect, [])
    .option('--port <n>', 'Port for the UI editor', '5174')
    .option('--detach', 'Run in background and return immediately')
    .action(async (componentName: string, options) => {
      const projectRoot = process.cwd();
      const port = options.port as string;
      const detach = Boolean(options.detach);
      const screenshotArgs = options.screenshot as string[];

      // Resolve and validate screenshot paths
      const screenshotPaths = screenshotArgs.map((p) => resolve(projectRoot, p));
      for (const p of screenshotPaths) {
        if (!existsSync(p)) {
          console.error(fmtError(`Screenshot not found: ${p}`));
          process.exit(1);
        }
      }

      // Resolve component path
      const componentsDir = join(projectRoot, 'code', 'components');
      const componentPath = join(componentsDir, `${componentName}.tsx`);

      // Scaffold component if it doesn't exist
      if (!existsSync(componentPath)) {
        if (!existsSync(componentsDir)) {
          mkdirSync(componentsDir, { recursive: true });
        }
        writeFileSync(componentPath, SCAFFOLD_TEMPLATE(componentName), 'utf-8');
        console.log(info(`Scaffolded component at ${chalk.cyan(componentPath)}`));
      }

      const sddUiDir = resolveSddUiDir();

      // Write .env.local — screenshot paths are pipe-separated (| is not valid in fs paths)
      const envLines = [
        `VITE_COMPONENT_PATH=${componentPath}`,
        `VITE_COMPONENT_NAME=${componentName}`,
        `VITE_SCREENSHOT_PATHS=${screenshotPaths.join('|')}`,
      ];
      await writeFile(join(sddUiDir, '.env.local'), envLines.join('\n'), 'utf-8');

      // Print launch info
      console.log('');
      console.log(success(`sdd-ui starting on ${chalk.cyan(`http://localhost:${port}`)}`));
      console.log(info(`Component:  ${chalk.cyan(componentPath)}`));
      for (const p of screenshotPaths) {
        console.log(info(`Screenshot: ${chalk.cyan(basename(p))}  ${chalk.dim(p)}`));
      }

      if (detach) {
        // Launch detached — process survives after sdd exits
        const vite = spawn('npx', ['vite', '--port', port], {
          cwd: sddUiDir,
          stdio: 'ignore',
          detached: true,
          shell: false,
        });
        vite.unref();

        // Save PID so `sdd ui stop` can kill it
        const pidFile = join(projectRoot, PID_FILE);
        writeFileSync(pidFile, String(vite.pid), 'utf-8');

        console.log(info(`Running in background  ${chalk.dim(`(PID ${vite.pid})`)}`));
        console.log(chalk.dim(`  Stop with: ${chalk.white('sdd ui stop')}\n`));
      } else {
        console.log(chalk.dim('  Press Ctrl+C to stop.\n'));

        const vite = spawn('npx', ['vite', '--port', port], {
          cwd: sddUiDir,
          stdio: 'inherit',
          shell: false,
        });

        vite.on('error', (err) => {
          console.error(fmtError(`Failed to start vite: ${err.message}`));
          process.exit(1);
        });

        vite.on('close', (code) => process.exit(code ?? 0));

        process.on('SIGINT', () => vite.kill('SIGINT'));
        process.on('SIGTERM', () => vite.kill('SIGTERM'));
      }
    });

  // stop
  ui
    .command('stop')
    .description('Stop a detached UI editor started with --detach')
    .action(() => {
      const projectRoot = process.cwd();
      const pidFile = join(projectRoot, PID_FILE);

      if (!existsSync(pidFile)) {
        console.log(info('No running sdd-ui process found.'));
        return;
      }

      const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);

      try {
        process.kill(pid, 'SIGTERM');
        unlinkSync(pidFile);
        console.log(success(`Stopped sdd-ui  ${chalk.dim(`(PID ${pid})`)}`));
      } catch {
        // Process already dead — clean up the stale pid file
        unlinkSync(pidFile);
        console.log(info('Process was already stopped. Cleaned up pid file.'));
      }
    });
}
