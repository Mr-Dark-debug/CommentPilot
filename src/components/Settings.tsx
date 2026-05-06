import React, { useEffect, useState } from 'react';
import { getSettings, saveSettings, AppSettings, clearAllData, clearHistory } from '../lib/storage';
import { DEFAULT_MODEL_BY_PROVIDER, PROVIDER_MODELS, type ProviderId } from '../lib/models';

export const Settings: React.FC = () => {
  const [settings, setLocalSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    getSettings().then(setLocalSettings);
  }, []);

  const handleChange = (key: keyof AppSettings, value: string) => {
    if (!settings) return;
    const newSettings = { ...settings, [key]: value };
    setLocalSettings(newSettings);
    saveSettings({ [key]: value });
  };

  const handleProviderChange = async (provider: ProviderId) => {
    if (!settings) {
      return;
    }

    const nextModel = DEFAULT_MODEL_BY_PROVIDER[provider];
    const nextSettings: AppSettings = {
      ...settings,
      provider,
      model: nextModel
    };

    setLocalSettings(nextSettings);
    await saveSettings({ provider, model: nextModel });
  };

  if (!settings) return <div className="p-4">Loading settings...</div>;

  return (
    <div className="p-4 space-y-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Settings</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">AI Provider</label>
        <select
          value={settings.provider}
          onChange={(e) => handleProviderChange(e.target.value as ProviderId)}
          className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="groq">Groq</option>
          <option value="openrouter">OpenRouter</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
        <select
          value={settings.model}
          onChange={(e) => handleChange('model', e.target.value)}
          className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          {PROVIDER_MODELS[settings.provider].map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {settings.provider === 'groq' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Groq API Key</label>
          <input
            type="password"
            value={settings.groqApiKey}
            onChange={(e) => handleChange('groqApiKey', e.target.value)}
            placeholder="gsk_..."
            className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {settings.provider === 'openrouter' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">OpenRouter API Key</label>
          <input
            type="password"
            value={settings.openrouterApiKey}
            onChange={(e) => handleChange('openrouterApiKey', e.target.value)}
            placeholder="sk-or-v1-..."
            className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      <div className="pt-4 border-t space-y-2">
        <button
          onClick={async () => {
            if(confirm('Clear history?')) {
              await clearHistory();
              alert('History cleared.');
            }
          }}
          className="w-full py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition"
        >
          Clear History
        </button>
        <button
          onClick={async () => {
            if(confirm('Clear ALL data including settings and API keys?')) {
              await clearAllData();
              alert('All data cleared.');
              window.location.reload();
            }
          }}
          className="w-full py-2 bg-red-50 text-red-600 rounded text-sm hover:bg-red-100 transition"
        >
          Factory Reset
        </button>
      </div>

      <div className="mt-4 text-xs text-gray-500 p-2 bg-gray-50 rounded">
        <strong>Privacy Notice:</strong> Your API keys and settings are stored locally in Chrome storage. Data is only sent to your chosen AI provider during generation.
      </div>
    </div>
  );
};
