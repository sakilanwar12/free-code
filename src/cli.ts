import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from './config.js';
import { startChat } from './chat.js';
import fs from 'fs';
import path from 'path';

const pkg = { version: '1.0.0', name: 'freepilot' };

export function runCLI(): void {
  const program = new Command();

  program
    .name('freepilot')
    .description('Autonomous AI coding agent for the terminal')
    .version(pkg.version)
    .option('-m, --model <model>', 'AI model to use')
    .option('-p, --provider <provider>', 'AI provider: openrouter (default), ollama, deepseek, openai')
    .option('-y, --yes', 'Auto-accept all file changes (non-interactive mode)')
    .action(async (options) => {
      const config = loadConfig({
        provider: options.provider,
        model: options.model,
        autoAccept: options.yes || undefined,
      });
      await startChat(config);
    });

  program
    .command('init')
    .description('Create a .env configuration file')
    .option('-p, --provider <provider>', 'Provider: openrouter (default), ollama, deepseek, openai')
    .action(async (options) => {
      const provider = options.provider || 'openrouter';
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        console.log(chalk.yellow('.env file already exists.'));
        return;
      }

      let content = `# Freepilot Configuration
FREEPILOT_PROVIDER=${provider}

`;

      if (provider === 'openai') {
        const { createInterface } = await import('readline');
        const apiKey = await new Promise<string>((resolve) => {
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          rl.question(chalk.cyan('Enter your OpenAI API key: '), (answer) => {
            rl.close();
            resolve(answer);
          });
        });
        if (!apiKey.trim()) {
          console.log(chalk.red('API key is required for OpenAI provider.'));
          return;
        }
        content += `OPENAI_API_KEY=${apiKey.trim()}
FREEPILOT_MODEL=gpt-4o-mini
`;
      } else if (provider === 'openrouter') {
        const { createInterface } = await import('readline');
        const apiKey = await new Promise<string>((resolve) => {
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          rl.question(chalk.cyan('Enter your OpenRouter API key (free at https://openrouter.ai/keys): '), (answer) => {
            rl.close();
            resolve(answer);
          });
        });
        if (!apiKey.trim()) {
          console.log(chalk.red('API key is required for OpenRouter provider.'));
          return;
        }
        content += `OPENROUTER_API_KEY=${apiKey.trim()}
# Recommended models: deepseek/deepseek-chat-v3:free, qwen/qwen-2.5-coder-32b-instruct:free, deepseek/deepseek-r1:free
FREEPILOT_MODEL=deepseek/deepseek-chat-v3:free
`;
      } else if (provider === 'deepseek') {
        const { createInterface } = await import('readline');
        const apiKey = await new Promise<string>((resolve) => {
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          rl.question(chalk.cyan('Enter your DeepSeek API key (free at https://platform.deepseek.com): '), (answer) => {
            rl.close();
            resolve(answer);
          });
        });
        if (!apiKey.trim()) {
          console.log(chalk.red('API key is required for DeepSeek provider.'));
          return;
        }
        content += `DEEPSEEK_API_KEY=${apiKey.trim()}
FREEPILOT_MODEL=deepseek-chat
`;
      } else {
        content += `# Ollama local setup (no API key needed)
# Make sure Ollama is running: https://ollama.ai
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=codellama
FREEPILOT_MODEL=codellama
`;
      }

      content += `
# Optional: General configuration
# FREEPILOT_MAX_TOKENS=4096
# FREEPILOT_TEMPERATURE=0.7
# FREEPILOT_AUTO_ACCEPT=false
`;

      fs.writeFileSync(envPath, content, 'utf-8');
      console.log(chalk.green(`\nCreated ${envPath}`));
      console.log(chalk.dim('You can also set these as environment variables.'));
    });

  program.parse(process.argv);
}
