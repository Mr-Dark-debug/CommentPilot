import { getSettings } from './storage';

export const PROVIDER_MODELS = {
  groq: [
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' },
    { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B' },
    { id: 'llama3-8b-8192', name: 'Llama 3 8B' },
    { id: 'llama3-70b-8192', name: 'Llama 3 70B' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
  ],
  openrouter: [
    { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)' },
    { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)' },
    { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Free)' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
  ],
};

export interface AIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export const generateCompletion = async (systemPrompt: string, userPrompt: string): Promise<string> => {
  const settings = await getSettings();

  if (settings.provider === 'groq') {
    if (!settings.groqApiKey) throw new Error("Groq API key not found. Please add it in Settings.");

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.groqApiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Groq API Error: ${error.error?.message || response.statusText}`);
    }

    const data: AIResponse = await response.json();
    return data.choices[0].message.content;
  } else if (settings.provider === 'openrouter') {
    if (!settings.openrouterApiKey) throw new Error("OpenRouter API key not found. Please add it in Settings.");

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openrouterApiKey}`,
        'HTTP-Referer': 'https://github.com/CommentPilot',
        'X-Title': 'CommentPilot Chrome Extension',
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenRouter API Error: ${error.error?.message || response.statusText}`);
    }

    const data: AIResponse = await response.json();
    return data.choices[0].message.content;
  }

  throw new Error("Invalid provider selected");
};
