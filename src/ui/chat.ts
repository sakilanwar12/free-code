import chalk from 'chalk';
import readline from 'readline';
import { renderStreamingChunk } from './markdown.js';

const SEPARATOR = chalk.dim('─'.repeat(Math.min(60, (process.stdout.columns || 80) - 4)));

export function printBanner(provider: string, model: string, cwd: string, gitStatus?: string): void {
  console.log();
  console.log(chalk.bold.hex('#38bdf8')('  ╔══════════════════════════════════════╗'));
  console.log(chalk.bold.hex('#38bdf8')('  ║') + chalk.bold.white('       Freepilot — AI Coding Agent      ') + chalk.bold.hex('#38bdf8')('║'));
  console.log(chalk.bold.hex('#38bdf8')('  ╚══════════════════════════════════════╝'));
  console.log();
  console.log(`  ${chalk.dim('Provider')}  ${chalk.white(provider)}`);
  console.log(`  ${chalk.dim('Model')}    ${chalk.white(model)}`);
  console.log(`  ${chalk.dim('Cwd')}      ${chalk.cyan(cwd)}`);
  if (gitStatus) {
    console.log(`  ${chalk.dim('Git')}     ${chalk.yellow(gitStatus)}`);
  }
  console.log();
  console.log(chalk.dim('  Commands:') + chalk.dim(' /help, /exit, /clear, /tokens, /model'));
  console.log();
}

export function printHelp(): void {
  console.log();
  console.log(chalk.bold.hex('#38bdf8')('  Commands'));
  console.log(SEPARATOR);
  console.log(`  ${chalk.cyan('/exit')}    ${chalk.dim('Exit the application')}`);
  console.log(`  ${chalk.cyan('/quit')}    ${chalk.dim('Exit the application')}`);
  console.log(`  ${chalk.cyan('/help')}    ${chalk.dim('Show this help message')}`);
  console.log(`  ${chalk.cyan('/clear')}   ${chalk.dim('Clear conversation history')}`);
  console.log(`  ${chalk.cyan('/tokens')}  ${chalk.dim('Show token usage and cost')}`);
  console.log(`  ${chalk.cyan('/model')}   ${chalk.dim('Show current model')}`);
  console.log(`  ${chalk.cyan('/model <name>')}  ${chalk.dim('Switch to a different model')}`);
  console.log(SEPARATOR);
  console.log();
}

export function printUserMessage(input: string): void {
  console.log();
  console.log(chalk.dim('  ┌─') + chalk.bold.white(' You ') + chalk.dim('─'.repeat(Math.min(40, (process.stdout.columns || 80) - 14))));
  process.stdout.write(`  ${chalk.white(input)}`);
  console.log();
  console.log(chalk.dim(`  └${'─'.repeat(Math.min(50, (process.stdout.columns || 80) - 4))}`));
  console.log();
}

export function printAssistantHeader(): void {
  console.log(chalk.dim('  ┌─') + chalk.bold.hex('#38bdf8')(' Freepilot ') + chalk.dim('─'.repeat(Math.min(38, (process.stdout.columns || 80) - 18))));
}

export function printAssistantFooter(): void {
  console.log();
  console.log(chalk.dim(`  └${'─'.repeat(Math.min(50, (process.stdout.columns || 80) - 4))}`));
  console.log();
}

export function renderAndWriteStreaming(text: string): void {
  const rendered = renderStreamingChunk(text);
  process.stdout.write(rendered);
}

export function printToolCall(name: string): void {
  const icon = name === 'edit' || name === 'search_replace' ? '✏️' :
    name === 'read_file' ? '📖' :
    name === 'bash' ? '⚡' :
    name === 'git_commit' ? '🔗' :
    name === 'plan' ? '📋' :
    name === 'task_complete' ? '✅' :
    name === 'grep_search' || name === 'glob_search' ? '🔍' : '🛠';
  process.stdout.write(chalk.dim(`\n  ${icon} ${name}... `));
}

export function printToolResult(success: boolean): void {
  if (success) {
    console.log(chalk.green('✓'));
  } else {
    console.log(chalk.red('✗'));
  }
}

export function clearLine(): void {
  process.stdout.write('\r\x1b[K');
}

export function printError(message: string, details?: string): void {
  console.log(`\n  ${chalk.red('✖')} ${chalk.bold.white(message)}`);
  if (details) {
    console.log(`  ${chalk.dim(details)}`);
  }
}

export function printSuccess(message: string): void {
  console.log(`  ${chalk.green('✔')} ${message}`);
}

export function printInfo(message: string): void {
  console.log(`  ${chalk.cyan('ℹ')} ${message}`);
}

export async function promptUser(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(chalk.hex('#38bdf8')('  ❯ '), (input) => {
      rl.close();
      resolve(input.trim());
    });
  });
}

export function closePrompt(): void {
}
