import { getSettings, hasSavedConfiguration } from './storage';

export interface AIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export const generateCompletion = async (systemPrompt: string, userPrompt: string): Promise<string> => {
  const settings = await getSettings();

  if (!hasSavedConfiguration(settings)) {
    throw new Error('Saved provider settings are incomplete. Save an API key and model in Settings before generating.');
  }

  if (settings.provider === 'groq') {
    if (!settings.groqApiKey) throw new Error("Groq API key not found. Please add it in Settings.");
    if (!settings.model) throw new Error('No Groq model selected. Save one in Settings first.');

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
      const error = await readErrorResponse(response);
      throw new Error(`Groq API Error: ${error}`);
    }

    const data: AIResponse = await response.json();
    return extractChoiceContent(data);
  } else if (settings.provider === 'openrouter') {
    if (!settings.openrouterApiKey) throw new Error("OpenRouter API key not found. Please add it in Settings.");
    if (!settings.model) throw new Error('No OpenRouter model selected. Save one in Settings first.');

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
      const error = await readErrorResponse(response);
      throw new Error(`OpenRouter API Error: ${error}`);
    }

    const data: AIResponse = await response.json();
    return extractChoiceContent(data);
  }

  throw new Error("Invalid provider selected");
};

function extractChoiceContent(data: AIResponse): string {
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('The AI provider returned an empty response.');
  }

  return content;
}

async function readErrorResponse(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    return payload?.error?.message || payload?.message || response.statusText;
  } catch {
    return response.statusText;
  }
}
