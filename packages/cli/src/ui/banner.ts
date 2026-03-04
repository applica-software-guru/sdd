import chalk from 'chalk';

export function printBanner(): void {
  console.log('');
  console.log(`  ${chalk.cyan.bold('SDD')} ${chalk.dim('—')} ${chalk.white('Story Driven Development')}`);
  console.log('');
}
