import { type ModelOption, type ProviderId } from './models';

export interface AppSettings {
  provider: ProviderId;
  model: string;
  groqApiKey: string;
  openrouterApiKey: string;
  providerModels: Partial<Record<ProviderId, ModelOption[]>>;
}

export interface HistoryItem {
  id: string;
  type: 'comment' | 'reply' | 'message';
  content: string;
  url: string;
  timestamp: number;
}

export interface PendingComposeContext {
  mode: 'comment' | 'reply' | 'message';
  contextText: string;
  commentText?: string;
  author?: string;
  url: string;
  source: 'linkedin-inline';
  timestamp: number;
}

export const getSettings = async (): Promise<AppSettings> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['provider', 'model', 'groqApiKey', 'openrouterApiKey', 'providerModels'],
      (result) => {
        const provider: ProviderId = result.provider === 'openrouter' ? 'openrouter' : 'groq';
        const model = typeof result.model === 'string' ? result.model : '';
        const providerModels = isProviderModelsRecord(result.providerModels) ? result.providerModels : {};

        resolve({
          provider,
          model,
          groqApiKey: typeof result.groqApiKey === 'string' ? result.groqApiKey : '',
          openrouterApiKey: typeof result.openrouterApiKey === 'string' ? result.openrouterApiKey : '',
          providerModels
        });
      }
    );
  });
};

export const saveSettings = async (settings: Partial<AppSettings>): Promise<void> => {
  return new Promise((resolve) => {
    chrome.storage.local.set(settings, () => {
      resolve();
    });
  });
};

export function hasSavedConfiguration(settings: Pick<AppSettings, 'provider' | 'model' | 'groqApiKey' | 'openrouterApiKey'>): boolean {
  const apiKey = settings.provider === 'groq' ? settings.groqApiKey : settings.openrouterApiKey;
  return Boolean(apiKey.trim() && settings.model.trim());
}

export const getHistory = async (): Promise<HistoryItem[]> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['history'], (result) => {
      resolve(Array.isArray(result.history) ? (result.history as HistoryItem[]) : []);
    });
  });
};

export const saveHistoryItem = async (item: Omit<HistoryItem, 'id' | 'timestamp'>): Promise<void> => {
  const history = await getHistory();
  const newItem: HistoryItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  history.unshift(newItem); // Add to beginning

  // Keep only last 50 items
  if (history.length > 50) {
    history.pop();
  }

  return new Promise((resolve) => {
    chrome.storage.local.set({ history }, () => {
      resolve();
    });
  });
};

export const clearHistory = async (): Promise<void> => {
  return new Promise((resolve) => {
    chrome.storage.local.remove('history', () => {
      resolve();
    });
  });
};

export const clearAllData = async (): Promise<void> => {
  return new Promise((resolve) => {
    chrome.storage.local.clear(() => {
      resolve();
    });
  });
};

export const getPendingComposeContext = async (): Promise<PendingComposeContext | null> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pendingComposeContext'], (result) => {
      const pendingContext = result.pendingComposeContext;
      resolve(isPendingComposeContext(pendingContext) ? pendingContext : null);
    });
  });
};

export const savePendingComposeContext = async (context: PendingComposeContext): Promise<void> => {
  return new Promise((resolve) => {
    chrome.storage.local.set({ pendingComposeContext: context }, () => {
      resolve();
    });
  });
};

export const clearPendingComposeContext = async (): Promise<void> => {
  return new Promise((resolve) => {
    chrome.storage.local.remove('pendingComposeContext', () => {
      resolve();
    });
  });
};

function isPendingComposeContext(value: unknown): value is PendingComposeContext {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PendingComposeContext>;
  return (
    (candidate.mode === 'comment' || candidate.mode === 'reply' || candidate.mode === 'message') &&
    typeof candidate.contextText === 'string' &&
    typeof candidate.url === 'string' &&
    candidate.source === 'linkedin-inline' &&
    typeof candidate.timestamp === 'number'
  );
}

function isProviderModelsRecord(value: unknown): value is Partial<Record<ProviderId, ModelOption[]>> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every((entry) => {
    if (!Array.isArray(entry)) {
      return false;
    }

    return entry.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as ModelOption).id === 'string' &&
        typeof (item as ModelOption).name === 'string'
    );
  });
}
