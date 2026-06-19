import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import os from 'os';
import path from 'path';
import fs from 'fs';

dotenvConfig();

export type Provider = 'ollama' | 'deepseek' | 'openai' | 'openrouter';

const envSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  FREEPILOT_PROVIDER: z.enum(['ollama', 'deepseek', 'openai', 'openrouter']).default('openrouter'),
  FREEPILOT_MODEL: z.string().optional(),
  FREEPILOT_MAX_TOKENS: z.coerce.number().default(4096),
  FREEPILOT_TEMPERATURE: z.coerce.number().default(0.7),
  FREEPILOT_AUTO_ACCEPT: z.coerce.boolean().default(false),

  // DeepSeek config
  DEEPSEEK_API_KEY: z.string().optional(),

  // Ollama config
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434/v1'),
  OLLAMA_MODEL: z.string().default('codellama'),

  // OpenRouter config
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
});

const DEFAULT_MODELS: Record<Provider, string> = {
  ollama: 'codellama',
  deepseek: 'deepseek-chat',
  openai: 'gpt-4o-mini',
  openrouter: 'deepseek/deepseek-v4-flash',
};

function loadEnvFile(): void {
  const envPaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env.local'),
    path.join(os.homedir(), '.config', 'freepilot', '.env'),
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      dotenvConfig({ path: envPath });
    }
  }
}

export interface Config {
  provider: Provider;
  apiKey?: string;
  baseURL: string;
  model: string;
  maxTokens: number;
  temperature: number;
  autoAccept: boolean;
}

function getBaseURL(provider: Provider, env: Record<string, string | undefined>): string {
  switch (provider) {
    case 'ollama':
      return env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
    case 'deepseek':
      return 'https://api.deepseek.com/v1';
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'openrouter':
      return env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  }
}

function getModel(provider: Provider, modelOverride: string | undefined, env: Record<string, string | undefined>): string {
  if (modelOverride) return modelOverride;
  if (provider === 'ollama' && env.OLLAMA_MODEL) return env.OLLAMA_MODEL;
  return DEFAULT_MODELS[provider];
}

function validateConfig(parsed: z.SafeParseReturnType<any, any>, provider: Provider): void {
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    console.error('Configuration error:');
    for (const [key, msgs] of Object.entries(errors)) {
      console.error(`  ${key}: ${msgs?.join(', ')}`);
    }
    process.exit(1);
  }

  if (provider === 'openai' && !parsed.data.OPENAI_API_KEY) {
    console.error('Configuration error:');
    console.error('  OPENAI_API_KEY is required when using OpenAI provider.');
    console.error('\nSet OPENAI_API_KEY in your environment or .env file, or use a different provider:');
    console.error('  FREEPILOT_PROVIDER=openrouter  (free models with free API key)');
    console.error('  FREEPILOT_PROVIDER=ollama  (local models, no API key needed)');
    console.error('  FREEPILOT_PROVIDER=deepseek  (free API tier)');
    process.exit(1);
  }

  if (provider === 'deepseek' && !parsed.data.DEEPSEEK_API_KEY) {
    console.error('Configuration error:');
    console.error('  DEEPSEEK_API_KEY is required when using DeepSeek provider.');
    console.error('\nGet your free API key at https://platform.deepseek.com/api_keys');
    process.exit(1);
  }

  if (provider === 'openrouter' && !parsed.data.OPENROUTER_API_KEY) {
    console.error('Configuration error:');
    console.error('  OPENROUTER_API_KEY is required when using OpenRouter provider.');
    console.error('\nGet your free API key at https://openrouter.ai/keys');
    process.exit(1);
  }
}

export function loadConfig(overrides?: Partial<Config>): Config {
  loadEnvFile();

  const env = process.env as Record<string, string | undefined>;
  const provider: Provider = (overrides?.provider as Provider) || env.FREEPILOT_PROVIDER || 'openrouter';

  const parsed = envSchema.safeParse(process.env);
  validateConfig(parsed, provider);

  const data = parsed.data!;
  const apiKey = provider === 'openai' ? data.OPENAI_API_KEY
    : provider === 'deepseek' ? env.DEEPSEEK_API_KEY
    : provider === 'openrouter' ? env.OPENROUTER_API_KEY
    : 'ollama';

  return {
    provider,
    apiKey,
    baseURL: getBaseURL(provider, env),
    model: getModel(provider, overrides?.model, env),
    maxTokens: overrides?.maxTokens || data.FREEPILOT_MAX_TOKENS,
    temperature: overrides?.temperature || data.FREEPILOT_TEMPERATURE,
    autoAccept: overrides?.autoAccept || data.FREEPILOT_AUTO_ACCEPT,
  };
}
