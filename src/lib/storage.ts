import { DEFAULT_MODEL_BY_PROVIDER, type ProviderId, isValidModelForProvider } from './models';

export interface AppSettings {
  provider: ProviderId;
  model: string;
  groqApiKey: string;
  openrouterApiKey: string;
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
      ['provider', 'model', 'groqApiKey', 'openrouterApiKey'],
      (result) => {
        const provider: ProviderId = result.provider === 'openrouter' ? 'openrouter' : 'groq';
        const fallbackModel = DEFAULT_MODEL_BY_PROVIDER[provider];
        const storedModel = typeof result.model === 'string' ? result.model : undefined;
        const model = isValidModelForProvider(provider, storedModel) ? storedModel : fallbackModel;

        resolve({
          provider,
          model,
          groqApiKey: typeof result.groqApiKey === 'string' ? result.groqApiKey : '',
          openrouterApiKey: typeof result.openrouterApiKey === 'string' ? result.openrouterApiKey : '',
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
