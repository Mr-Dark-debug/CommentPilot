export interface AppSettings {
  provider: 'groq' | 'openrouter';
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

export const getSettings = async (): Promise<AppSettings> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['provider', 'model', 'groqApiKey', 'openrouterApiKey'],
      (result) => {
        resolve({
          provider: result.provider || 'groq',
          model: result.model || 'llama3-8b-8192',
          groqApiKey: result.groqApiKey || '',
          openrouterApiKey: result.openrouterApiKey || '',
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
      resolve(result.history || []);
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
