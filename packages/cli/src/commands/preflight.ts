import { Command } from 'commander';
import chalk from 'chalk';
import { SDD } from '@applica-software-guru/sdd-core';
import { heading, info, success, warning, statusIcon, statusLabel } from '../ui/format.js';

export function registerPreflight(program: Command): void {
  program
    .command('preflight')
    .description('Run a pre-flight check: validate docs, list transient/draft files, pending CRs, open bugs. Exits non-zero if anything is pending.')
    .option('--no-validate', 'Skip documentation validation (cross-references, frontmatter)')
    .action(async (options: { validate: boolean }) => {
      const sdd = new SDD({ root: process.cwd() });
      const result = await sdd.preflight();

      console.log(heading('Preflight check'));

      const sections: Array<{ ok: boolean; print: () => void }> = [];

      // 1. Documentation validation
      const validation = result.validation;
      const validationOk = options.validate === false ? true : validation.valid;
      sections.push({
        ok: validationOk,
        print: () => {
          if (options.validate === false) {
            console.log(info('Validation skipped (--no-validate).'));
            return;
          }
          if (validation.valid) {
            console.log(success('Documentation is valid (no broken references).'));
            return;
          }
          console.log(warning(`Documentation issues (${validation.issues.length}):`));
          for (const issue of validation.issues) {
            const icon = issue.severity === 'error' ? chalk.red('  ✗') : chalk.yellow('  ⚠');
            console.log(`${icon} ${chalk.white(issue.filePath)} ${chalk.dim(`[${issue.rule}]`)} ${issue.message}`);
          }
        },
      });

      // 2. Transient docs (new/changed/deleted)
      sections.push({
        ok: result.transientDocs.length === 0,
        print: () => {
          if (result.transientDocs.length === 0) {
            console.log(success('No transient documentation (all docs synced).'));
            return;
          }
          console.log(warning(`Transient documentation (${result.transientDocs.length}) — code not yet aligned:`));
          for (const f of result.transientDocs) {
            console.log(`  ${statusIcon(f.frontmatter.status)} ${chalk.white(f.relativePath)} ${statusLabel(f.frontmatter.status)}`);
          }
        },
      });

      // 3. Drafts (docs / crs / bugs)
      const draftCount = result.drafts.docs.length + result.drafts.crs.length + result.drafts.bugs.length;
      sections.push({
        ok: draftCount === 0,
        print: () => {
          if (draftCount === 0) {
            console.log(success('No abandoned drafts.'));
            return;
          }
          console.log(warning(`Drafts not enriched (${draftCount}):`));
          for (const f of result.drafts.docs) {
            console.log(`  ${statusIcon('draft')} ${chalk.white(f.relativePath)} ${chalk.magenta('draft')}`);
          }
          for (const cr of result.drafts.crs) {
            console.log(`  ${statusIcon('draft')} ${chalk.white(cr.relativePath)} ${chalk.magenta('draft')} ${chalk.cyan(cr.frontmatter.title)}`);
          }
          for (const b of result.drafts.bugs) {
            console.log(`  ${statusIcon('draft')} ${chalk.white(b.relativePath)} ${chalk.magenta('draft')} ${chalk.cyan(b.frontmatter.title)}`);
          }
        },
      });

      // 4. Pending CRs
      sections.push({
        ok: result.pendingCRs.length === 0,
        print: () => {
          if (result.pendingCRs.length === 0) {
            console.log(success('No pending change requests.'));
            return;
          }
          console.log(warning(`Pending change requests (${result.pendingCRs.length}) — apply to docs before syncing:`));
          for (const cr of result.pendingCRs) {
            console.log(`  ${chalk.yellow('●')} ${chalk.white(cr.relativePath)} ${chalk.cyan(cr.frontmatter.title)}`);
          }
        },
      });

      // 5. Open bugs
      sections.push({
        ok: result.openBugs.length === 0,
        print: () => {
          if (result.openBugs.length === 0) {
            console.log(success('No open bugs.'));
            return;
          }
          console.log(warning(`Open bugs (${result.openBugs.length}) — fix before syncing:`));
          for (const b of result.openBugs) {
            console.log(`  ${chalk.yellow('●')} ${chalk.white(b.relativePath)} ${chalk.cyan(b.frontmatter.title)}`);
          }
        },
      });

      for (const s of sections) s.print();

      const failing = sections.filter((s) => !s.ok);
      console.log('');
      if (failing.length === 0) {
        console.log(chalk.green.bold('  ✓ Preflight passed — nothing pending.\n'));
        return;
      }
      console.log(chalk.red.bold(`  ✗ Preflight failed — ${failing.length} check(s) need attention.\n`));
      process.exit(1);
    });
}
