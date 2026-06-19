export interface ModelEntry {
  id: string;
  name: string;
  provider: 'openrouter' | 'openai' | 'deepseek' | 'ollama';
  paid: boolean;
  description: string;
}

export const MODEL_LIST: ModelEntry[] = [
  // ===== OpenRouter Free Models =====
  { id: 'deepseek/deepseek-chat-v3:free', name: 'DeepSeek V3', provider: 'openrouter', paid: false, description: 'Fast, good reasoning, best for coding agents' },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1', provider: 'openrouter', paid: false, description: 'Strong reasoning, step-by-step thinking' },
  { id: 'qwen/qwen-2.5-coder-32b-instruct:free', name: 'Qwen Coder 2.5', provider: 'openrouter', paid: false, description: 'Best for code generation & multi-file refactor' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', provider: 'openrouter', paid: false, description: 'Stable chat, general coding, good fallback' },
  { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B', provider: 'openrouter', paid: false, description: 'Fast, lightweight, simple tasks' },
  { id: 'openrouter/free', name: 'Auto Router', provider: 'openrouter', paid: false, description: 'Auto-selects best free model' },

  // ===== OpenRouter Paid Models =====
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude Sonnet 3.5', provider: 'openrouter', paid: true, description: 'Best overall coding (requires OpenRouter key with credits)' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openrouter', paid: true, description: 'OpenAI via OpenRouter (requires credits)' },
  { id: 'openai/o3-mini', name: 'o3-mini', provider: 'openrouter', paid: true, description: 'Fast reasoning model via OpenRouter' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'openrouter', paid: true, description: 'Google via OpenRouter (requires credits)' },

  // ===== DeepSeek Native =====
  { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', paid: false, description: 'Direct DeepSeek API (free tier, needs API key)' },
  { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'deepseek', paid: false, description: 'Direct DeepSeek coding model' },

  // ===== OpenAI Native =====
  { id: 'gpt-4o-mini', name: 'GPT-4o-mini', provider: 'openai', paid: true, description: 'Cheap OpenAI model (needs API key)' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', paid: true, description: 'Full GPT-4o (needs API key)' },

  // ===== Ollama Local =====
  { id: 'codellama', name: 'Code Llama', provider: 'ollama', paid: false, description: 'Local via Ollama (no API key needed)' },
  { id: 'llama3.1', name: 'Llama 3.1', provider: 'ollama', paid: false, description: 'Local via Ollama' },
  { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder', provider: 'ollama', paid: false, description: 'Local via Ollama' },
  { id: 'deepseek-coder:local', name: 'DeepSeek Coder (local)', provider: 'ollama', paid: false, description: 'Local via Ollama' },
  { id: 'mistral', name: 'Mistral', provider: 'ollama', paid: false, description: 'Local via Ollama' },
];

export function getModelById(id: string): ModelEntry | undefined {
  return MODEL_LIST.find(m => m.id === id);
}

export function getModelsByProvider(provider: string): ModelEntry[] {
  return MODEL_LIST.filter(m => m.provider === provider);
}

export function getFreeModels(): ModelEntry[] {
  return MODEL_LIST.filter(m => !m.paid);
}

export function getPaidModels(): ModelEntry[] {
  return MODEL_LIST.filter(m => m.paid);
}
