import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { type Config, type Provider } from './config.js';
import { buildSystemPrompt } from './system.js';
import { toolDefinitions, executeToolCall } from './ai/tools.js';
import { MODEL_LIST, getModelById } from './models.js';
import {
  printBanner,
  printHelp as printChatHelp,
  printUserMessage,
  printAssistantHeader,
  printAssistantFooter,
  renderAndWriteStreaming,
  printToolCall,
  printToolResult,
  printError,
  printSuccess,
  printInfo,
  clearLine,
  promptUser,
  closePrompt,
} from './ui/chat.js';
import { estimateTokens, formatCost } from './utils/tokens.js';
import { isGitRepository } from './tools/git.js';
import { setAutoAccept } from './tools/diff.js';
import fg from 'fast-glob';
import readline from 'readline';

function getGitStatusSummary(): string {
  try {
    const output = execSync('git status --porcelain', {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    if (!output) return 'clean working tree';
    const lines = output.split('\n').filter(Boolean);
    return `${lines.length} uncommitted change${lines.length !== 1 ? 's' : ''}`;
  } catch {
    return '';
  }
}

async function getFileCount(): Promise<number> {
  try {
    const files = await fg('**/*', {
      ignore: ['node_modules/**', '.git/**', 'dist/**', '.next/**', '*.lock'],
      onlyFiles: true,
    });
    return files.length;
  } catch {
    return 0;
  }
}

function promptForApiKey(provider: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const urls: Record<string, string> = {
    openai: 'https://platform.openai.com/api-keys',
    openrouter: 'https://openrouter.ai/keys',
    deepseek: 'https://platform.deepseek.com/api_keys',
  };
  return new Promise((resolve) => {
    rl.question(chalk.cyan(`  Enter your ${provider} API key (get at ${urls[provider] || ''}): `), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function getBaseURLForProvider(provider: Provider): string {
  switch (provider) {
    case 'openrouter': return 'https://openrouter.ai/api/v1';
    case 'deepseek': return 'https://api.deepseek.com/v1';
    case 'openai': return 'https://api.openai.com/v1';
    case 'ollama': return 'http://localhost:11434/v1';
  }
}

function createClient(config: Config): OpenAI {
  return new OpenAI({ apiKey: config.apiKey || '', baseURL: config.baseURL });
}

async function switchModel(config: Config, modelId: string): Promise<boolean> {
  const entry = getModelById(modelId);
  if (!entry) {
    printError(`Unknown model: ${modelId}`);
    return false;
  }

  config.model = entry.id;
  config.provider = entry.provider;
  config.baseURL = getBaseURLForProvider(entry.provider);

  if (entry.paid && !config.apiKey) {
    printInfo(`Model "${entry.name}" requires API key for ${entry.provider}`);
    const key = await promptForApiKey(entry.provider);
    if (!key) {
      printError('API key required for paid model. Switch cancelled.');
      return false;
    }
    config.apiKey = key;
  }

  if (entry.provider === 'ollama') {
    config.apiKey = 'ollama';
  } else if (!entry.paid && entry.provider === 'openrouter') {
    // Free OpenRouter model - use existing key or empty
    if (!config.apiKey) config.apiKey = 'none';
  }

  printSuccess(`Switched to ${chalk.bold(entry.name)} (${entry.id})`);
  return true;
}

function printModelList(): void {
  const groups: { title: string; models: typeof MODEL_LIST; color: (s: string) => string }[] = [
    { title: 'OpenRouter Free', color: chalk.green, models: MODEL_LIST.filter(m => m.provider === 'openrouter' && !m.paid) },
    { title: 'OpenRouter Paid', color: chalk.yellow, models: MODEL_LIST.filter(m => m.provider === 'openrouter' && m.paid) },
    { title: 'DeepSeek', color: chalk.cyan, models: MODEL_LIST.filter(m => m.provider === 'deepseek') },
    { title: 'OpenAI', color: chalk.magenta, models: MODEL_LIST.filter(m => m.provider === 'openai') },
    { title: 'Ollama Local', color: chalk.blue, models: MODEL_LIST.filter(m => m.provider === 'ollama') },
  ];

  console.log(`\n  ${chalk.bold('Available Models')}`);
  console.log(chalk.dim('  ' + '─'.repeat(50)));
  let idx = 1;

  for (const group of groups) {
    if (group.models.length === 0) continue;
    console.log(`\n  ${group.color(chalk.bold(group.title))}`);
    for (const m of group.models) {
      const icon = m.paid ? chalk.yellow('$') : chalk.green('✓');
      const num = String(idx).padStart(2);
      console.log(`  ${chalk.dim(`${num}.`)} ${icon} ${chalk.bold(m.name.padEnd(22))} ${chalk.dim(m.description)}`);
      idx++;
    }
  }
  console.log(`\n  ${chalk.dim('Type')} ${chalk.cyan('/model <number>')} ${chalk.dim('to switch, or')} ${chalk.cyan('/model <name>')} ${chalk.dim('for any model ID')}`);
}

async function* streamCompletion(
  client: OpenAI,
  messages: ChatCompletionMessageParam[],
  config: Config
): AsyncGenerator<
  { type: 'content'; text: string } | { type: 'tool_calls'; toolCalls: any[] } | { type: 'error'; message: string }
> {
  try {
    const stream = await client.chat.completions.create({
      model: config.model,
      messages,
      tools: toolDefinitions,
      stream: true,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    });

    let content = '';
    const toolCallAccumulators = new Map<
      number,
      { id: string; type: 'function'; function: { name: string; arguments: string } }
    >();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        content += delta.content;
        yield { type: 'content', text: delta.content };
      }

      if (delta?.tool_calls) {
        for (const tcDelta of delta.tool_calls) {
          const idx = tcDelta.index;
          if (!toolCallAccumulators.has(idx)) {
            toolCallAccumulators.set(idx, {
              id: '',
              type: 'function',
              function: { name: '', arguments: '' },
            });
          }
          const acc = toolCallAccumulators.get(idx)!;
          if (tcDelta.id) acc.id = tcDelta.id;
          if (tcDelta.function?.name) acc.function.name += tcDelta.function.name;
          if (tcDelta.function?.arguments) acc.function.arguments += tcDelta.function.arguments;
        }
      }
    }

    const toolCalls = Array.from(toolCallAccumulators.values());

    if (toolCalls.length > 0) {
      yield { type: 'tool_calls', toolCalls };
    } else {
      yield { type: 'content', text: content };
    }
  } catch (error: any) {
    yield { type: 'error', message: error.message };
  }
}

export async function startChat(config: Config): Promise<void> {
  setAutoAccept(config.autoAccept);

  const gitStatus = getGitStatusSummary();
  const fileCount = await getFileCount();
  const context = {
    cwd: process.cwd(),
    gitStatus,
    fileCount,
  };

  let client = createClient(config);
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(context) },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  printBanner(config.provider, config.model, context.cwd, gitStatus || undefined);

  while (true) {
    const input = await promptUser();

    if (!input) continue;

    if (input.startsWith('/')) {
      const parts = input.split(/\s+/);
      const cmd = parts[0].toLowerCase();

      switch (cmd) {
        case '/exit':
        case '/quit':
          printSuccess('Goodbye!');
          closePrompt();
          return;

        case '/help':
          printChatHelp();
          continue;

        case '/clear':
          messages.length = 0;
          messages.push({ role: 'system', content: buildSystemPrompt(context) });
          printSuccess('Conversation history cleared.');
          continue;

        case '/tokens':
          console.log(
            `\n  ${chalk.cyan('ℹ')} Input: ~${totalInputTokens} | Output: ~${totalOutputTokens} | Cost: ${formatCost(totalInputTokens, totalOutputTokens, config.model)}`
          );
          continue;

        case '/model':
          if (parts[1]) {
            // Check if it's a number (index into listed models)
            const num = parseInt(parts[1]);
            if (!isNaN(num) && num >= 1 && num <= MODEL_LIST.length) {
              const selected = MODEL_LIST[num - 1];
              const ok = await switchModel(config, selected.id);
              if (ok) {
                config.baseURL = getBaseURLForProvider(config.provider);
                client = createClient(config);
              }
            } else {
              // Treat as model ID
              const ok = await switchModel(config, parts[1]);
              if (ok) {
                config.baseURL = getBaseURLForProvider(config.provider);
                client = createClient(config);
              }
            }
          } else {
            printModelList();
            console.log(`\n  ${chalk.dim('Current:')} ${chalk.white(config.model)}`);
          }
          continue;

        default:
          printError(`Unknown command: ${cmd}. Type /help for available commands.`);
          continue;
      }
    }

    printUserMessage(input);

    messages.push({ role: 'user', content: input });
    totalInputTokens += estimateTokens(input);

    let toolCallDepth = 0;
    const MAX_TOOL_DEPTH = 20;

    while (toolCallDepth < MAX_TOOL_DEPTH) {
      toolCallDepth++;

      const spinnerTimer = setInterval(() => {
        process.stdout.write(`\r${chalk.dim('  ⏳ Thinking...')}`);
      }, 150);

      let gotResponse = false;

      try {
        const streamGen = streamCompletion(client, messages, config);
        let toolCalls: any[] | null = null;
        let error: string | null = null;
        let content = '';
        let startedStreaming = false;

        for await (const event of streamGen) {
          if (!gotResponse) {
            clearInterval(spinnerTimer);
            clearLine();
            gotResponse = true;
          }

          switch (event.type) {
            case 'content':
              if (!startedStreaming) {
                startedStreaming = true;
                printAssistantHeader();
              }
              content += event.text;
              renderAndWriteStreaming(event.text);
              break;
            case 'tool_calls':
              if (startedStreaming) {
                printAssistantFooter();
              }
              toolCalls = event.toolCalls;
              break;
            case 'error':
              error = event.message;
              break;
          }
        }

        if (!gotResponse) {
          clearInterval(spinnerTimer);
          clearLine();
          gotResponse = true;
        }

        if (error) {
          printError(error);
          break;
        }

        if (toolCalls && toolCalls.length > 0) {
          const assistantMessage: ChatCompletionMessageParam = {
            role: 'assistant',
            content: content || null,
            tool_calls: toolCalls.map((tc: any) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })),
          };
          messages.push(assistantMessage);

          for (const tc of toolCalls) {
            const toolName = tc.function.name;
            const displayName = toolName === 'search_replace' ? 'edit' : toolName;
            printToolCall(displayName);

            try {
              const result = await executeToolCall(toolName, tc.function.arguments);
              printToolResult(true);
              totalInputTokens += estimateTokens(result);

              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: result,
              } as ChatCompletionMessageParam);
            } catch (execError: any) {
              printToolResult(false);
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: `Error executing ${toolName}: ${execError.message}`,
              } as ChatCompletionMessageParam);
            }
          }

          continue;
        }

        if (startedStreaming) {
          printAssistantFooter();
        }

        messages.push({ role: 'assistant', content });
        totalOutputTokens += estimateTokens(content);

        if (isGitRepository()) {
          const status = getGitStatusSummary();
          if (status) {
            console.log(`  ${chalk.dim('Git:')} ${chalk.yellow(status)}`);
          }
        }

        break;
      } catch (error: any) {
        clearInterval(spinnerTimer);
        clearLine();
        printError('Request failed', error.message);
        break;
      }
    }

    if (toolCallDepth >= MAX_TOOL_DEPTH) {
      console.log(`  ${chalk.yellow('⚠')} Warning: Reached maximum tool call depth.`);
    }

    const MAX_HISTORY = 60;
    if (messages.length > MAX_HISTORY) {
      const system = messages[0];
      const recent = messages.slice(-40);
      messages.length = 0;
      messages.push(system, ...recent);
    }
  }
}
