export type ProviderId = 'groq' | 'openrouter';

export interface ModelOption {
  id: string;
  name: string;
}

export const PROVIDER_MODELS: Record<ProviderId, ModelOption[]> = {
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
};

export const DEFAULT_MODEL_BY_PROVIDER: Record<ProviderId, string> = {
  groq: 'llama-3.1-8b-instant',
  openrouter: 'meta-llama/llama-3.1-8b-instruct:free'
};

export function isValidModelForProvider(
  provider: ProviderId,
  model: string | undefined,
  options: ModelOption[] = PROVIDER_MODELS[provider]
): model is string {
  if (!model) {
    return false;
  }

  return options.some((option) => option.id === model);
}

export function getDefaultModelForProvider(provider: ProviderId, options: ModelOption[] = PROVIDER_MODELS[provider]): string {
  return options[0]?.id || DEFAULT_MODEL_BY_PROVIDER[provider];
}

export async function fetchProviderModels(provider: ProviderId, apiKey: string): Promise<ModelOption[]> {
  const headers: HeadersInit = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  const response = await fetch(
    provider === 'groq' ? 'https://api.groq.com/openai/v1/models' : 'https://openrouter.ai/api/v1/models',
    {
      method: 'GET',
      headers
    }
  );

  if (!response.ok) {
    throw new Error(await readProviderError(response, provider));
  }

  const payload = await response.json();
  const rawModels = Array.isArray(payload?.data) ? payload.data : [];
  const options = rawModels
    .map((model: any) => ({
      id: typeof model?.id === 'string' ? model.id : '',
      name:
        typeof model?.name === 'string' && model.name.trim()
          ? model.name.trim()
          : (typeof model?.id === 'string' ? model.id : '')
    }))
    .filter((model: ModelOption) => model.id);

  if (!options.length) {
    throw new Error(`No models were returned by ${provider === 'groq' ? 'Groq' : 'OpenRouter'}.`);
  }

  return options;
}

async function readProviderError(response: Response, provider: ProviderId): Promise<string> {
  const providerName = provider === 'groq' ? 'Groq' : 'OpenRouter';

  try {
    const payload = await response.json();
    const message = payload?.error?.message || payload?.message || response.statusText;
    return `${providerName} model fetch failed: ${message}`;
  } catch {
    return `${providerName} model fetch failed: ${response.statusText}`;
  }
}
