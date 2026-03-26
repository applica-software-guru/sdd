import { hostname } from 'node:os';
import { Command } from 'commander';
import chalk from 'chalk';
import { input, password } from '@inquirer/prompts';
import { SDD, readConfig, writeConfig, buildApiConfig, startWorkerDaemon } from '@applica-software-guru/sdd-core';
import { heading, success, info, warning, error as errorFmt } from '../ui/format.js';
import { renderMarkdown } from '../ui/markdown.js';

export function registerRemote(program: Command): void {
  const remote = program
    .command('remote')
    .description('Manage remote sync with SDD Flow');

  remote
    .command('init')
    .description('Configure remote API connection')
    .option('--url <url>', 'SDD Flow API base URL')
    .option('--api-key <key>', 'API key (prefer SDD_API_KEY env var)')
    .option('--timeout <seconds>', 'Remote request timeout in seconds (default: 300)', parseInt)
    .action(async (options: { url?: string; apiKey?: string; timeout?: number }) => {
      const root = process.cwd();
      const config = await readConfig(root);

      const url =
        options.url ??
        (await input({
          message: 'SDD Flow API URL',
          default: config.remote?.url ?? 'https://sdd.applica.guru/api/v1',
        }));

      const apiKey =
        options.apiKey ??
        (await password({
          message: 'API key (leave empty to use SDD_API_KEY env var)',
        }));

      config.remote = {
        url: url.replace(/\/+$/, ''),
      };
      if (apiKey) {
        config.remote['api-key'] = apiKey;
      }
      if (options.timeout) {
        config.remote.timeout = options.timeout;
      }

      await writeConfig(root, config);
      console.log(success('Remote configuration saved to .sdd/config.yaml'));

      if (!apiKey && !process.env.SDD_API_KEY) {
        console.log(warning('No API key found. Set SDD_API_KEY environment variable or re-run with --api-key.'));
        return;
      }

      // Test connection
      console.log(info('Testing connection...'));
      try {
        const sdd = new SDD({ root });
        const status = await sdd.remoteStatus(options.timeout);
        if (status.connected) {
          console.log(success(`Connected! Remote has ${status.remoteDocs} document(s).`));
        } else {
          console.log(errorFmt('Could not connect to remote. Check URL and API key.'));
        }
      } catch (err) {
        console.log(errorFmt(`Connection failed: ${(err as Error).message}`));
      }
      console.log('');
    });

  remote
    .command('status')
    .description('Show remote sync status')
    .option('--timeout <seconds>', 'Remote request timeout in seconds (default: 300)', parseInt)
    .action(async (options: { timeout?: number }) => {
      const sdd = new SDD({ root: process.cwd() });
      const status = await sdd.remoteStatus(options.timeout);

      console.log(heading('Remote Status'));

      if (!status.configured) {
        console.log(info('Remote not configured. Run "sdd remote init" to set up.\n'));
        return;
      }

      console.log(`  ${chalk.dim('URL:')}         ${chalk.white(status.url)}`);
      console.log(
        `  ${chalk.dim('Connection:')}  ${
          status.connected ? chalk.green.bold('connected') : chalk.red.bold('disconnected')
        }`,
      );
      console.log(`  ${chalk.dim('Local pending:')} ${chalk.yellow.bold(String(status.localPending))} file(s)`);
      if (status.connected) {
        console.log(`  ${chalk.dim('Remote docs:')}  ${chalk.cyan.bold(String(status.remoteDocs))} document(s)`);
      }
      console.log('');
    });

  remote
    .command('reset')
    .description('Delete all project data from remote (docs, CRs, bugs)')
    .requiredOption('--confirm <slug>', 'Project slug to confirm the reset')
    .option('--timeout <seconds>', 'Remote request timeout in seconds (default: 300)', parseInt)
    .action(async (options: { confirm: string; timeout?: number }) => {
      const sdd = new SDD({ root: process.cwd() });

      console.log(heading('Reset Remote Project'));
      console.log(warning('This will permanently delete ALL documents, CRs, and bugs from the remote project.'));
      console.log('');

      try {
        const result = await sdd.remoteReset(options.confirm, options.timeout);
        console.log(success(result.message));
        console.log(chalk.dim(`  Documents:       ${result.deleted_documents}`));
        console.log(chalk.dim(`  Change requests: ${result.deleted_change_requests}`));
        console.log(chalk.dim(`  Bugs:            ${result.deleted_bugs}`));
        console.log(chalk.dim(`  Comments:        ${result.deleted_comments}`));
        console.log(chalk.dim(`  Notifications:   ${result.deleted_notifications}`));
        console.log('');
        console.log(info('Local remote-state has been cleared and marked for reseed.'));
        console.log(info('The next "sdd push" without explicit file paths will repopulate the remote from local files.'));
      } catch (err) {
        console.log(errorFmt((err as Error).message));
      }
      console.log('');
    });

  remote
    .command('worker')
    .description('Start a persistent worker that receives and executes jobs from SDD Flow')
    .option('--name <name>', 'Worker name (default: hostname)')
    .option('--agent <agent>', 'Agent to use for executing jobs (default: from config or "claude")')
    .option('--timeout <seconds>', 'Remote request timeout in seconds (default: 300)', parseInt)
    .action(async (options: { name?: string; agent?: string; timeout?: number }) => {
      const root = process.cwd();
      const config = await readConfig(root);

      console.log(heading('SDD Remote Worker'));

      try {
        const apiConfig = buildApiConfig(config, options.timeout);
        const agentName = options.agent ?? config.agent ?? 'claude';

        const branchName = config.branch ?? 'sdd';
        console.log(info(`Starting worker "${options.name ?? hostname()}" with agent "${agentName}"...`));
        console.log(info(`Connected to ${apiConfig.baseUrl}`));
        console.log(info(`Working branch: ${branchName}`));
        console.log('');

        await startWorkerDaemon({
          root,
          name: options.name,
          agent: agentName,
          branch: branchName,
          agents: config.agents,
          apiConfig,
          onLog: (msg: string) => {
            const timestamp = new Date().toISOString().slice(11, 19);
            console.log(`${chalk.dim(timestamp)} ${msg}`);
          },
          renderPrompt: renderMarkdown,
        });
      } catch (err) {
        console.log(errorFmt((err as Error).message));
        process.exit(1);
      }
    });
}
