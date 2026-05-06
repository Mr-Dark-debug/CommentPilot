export type ProviderId = 'groq' | 'openrouter';

export const PROVIDER_MODELS = {
  groq: [
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' },
    { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B' },
    { id: 'llama3-8b-8192', name: 'Llama 3 8B' },
    { id: 'llama3-70b-8192', name: 'Llama 3 70B' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B' }
  ],
  openrouter: [
    { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)' },
    { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)' },
    { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Free)' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' }
  ]
} as const;

export const DEFAULT_MODEL_BY_PROVIDER: Record<ProviderId, string> = {
  groq: 'llama-3.1-8b-instant',
  openrouter: 'meta-llama/llama-3.1-8b-instruct:free'
};

export function isValidModelForProvider(provider: ProviderId, model: string | undefined): model is string {
  if (!model) {
    return false;
  }

  return PROVIDER_MODELS[provider].some((option) => option.id === model);
}
