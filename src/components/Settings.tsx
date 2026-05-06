import React, { useEffect, useMemo, useState } from 'react';
import { Check, LoaderCircle, RefreshCw, Save } from 'lucide-react';
import { clearAllData, clearHistory, getSettings, hasSavedConfiguration, saveSettings, type AppSettings } from '../lib/storage';
import {
  fetchProviderModels,
  getDefaultModelForProvider,
  type ModelOption,
  type ProviderId
} from '../lib/models';

type SaveState = 'idle' | 'saving' | 'saved';
type ModelLoadState = 'idle' | 'loading';

const emptySettings: AppSettings = {
  provider: 'groq',
  model: '',
  groqApiKey: '',
  openrouterApiKey: '',
  providerModels: {}
};

export const Settings: React.FC = () => {
  const [savedSettings, setSavedSettings] = useState<AppSettings | null>(null);
  const [draftSettings, setDraftSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [modelLoadState, setModelLoadState] = useState<ModelLoadState>('idle');

  useEffect(() => {
    getSettings().then((settings) => {
      const hydrated = {
        ...emptySettings,
        ...settings
      };

      setSavedSettings(hydrated);
      setDraftSettings(hydrated);
    });
  }, []);

  const activeProvider = draftSettings?.provider || 'groq';
  const availableModels = useMemo(() => {
    if (!draftSettings) {
      return [];
    }

    const cachedModels = draftSettings.providerModels[activeProvider] || [];
    if (cachedModels.length > 0) {
      return cachedModels;
    }

    if (draftSettings.model) {
      return [{ id: draftSettings.model, name: draftSettings.model }];
    }

    return [];
  }, [activeProvider, draftSettings]);

  const hasUnsavedChanges = useMemo(() => {
    if (!savedSettings || !draftSettings) {
      return false;
    }

    return JSON.stringify(savedSettings) !== JSON.stringify(draftSettings);
  }, [draftSettings, savedSettings]);

  const canFetchModels = useMemo(() => {
    if (!draftSettings) {
      return false;
    }

    const apiKey = activeProvider === 'groq' ? draftSettings.groqApiKey : draftSettings.openrouterApiKey;
    return Boolean(apiKey.trim());
  }, [activeProvider, draftSettings]);

  const canSave = useMemo(() => {
    if (!draftSettings) {
      return false;
    }

    return hasSavedConfiguration(draftSettings) && hasUnsavedChanges && saveState !== 'saving';
  }, [draftSettings, hasUnsavedChanges, saveState]);

  if (!draftSettings) {
    return <div className="p-4">Loading settings...</div>;
  }

  const setDraftField = (key: keyof AppSettings, value: string) => {
    setDraftSettings((current) => (current ? { ...current, [key]: value } : current));
    setSaveState('idle');
    setError(null);
    setInfo(null);
  };

  const handleProviderChange = (provider: ProviderId) => {
    setDraftSettings((current) => {
      if (!current) {
        return current;
      }

      const providerModels = current.providerModels[provider] || [];
      const nextModel = providerModels.length > 0 && providerModels.some((option) => option.id === current.model)
        ? current.model
        : (providerModels.length > 0 ? getDefaultModelForProvider(provider, providerModels) : '');

      return {
        ...current,
        provider,
        model: nextModel
      };
    });

    setSaveState('idle');
    setError(null);
    setInfo(null);
  };

  const handleFetchModels = async () => {
    const apiKey = activeProvider === 'groq' ? draftSettings.groqApiKey : draftSettings.openrouterApiKey;
    if (!apiKey.trim()) {
      setError(`Enter your ${activeProvider === 'groq' ? 'Groq' : 'OpenRouter'} API key first.`);
      return;
    }

    setModelLoadState('loading');
    setError(null);
    setInfo(null);

    try {
      const models = await fetchProviderModels(activeProvider, apiKey.trim());

      setDraftSettings((current) => {
        if (!current) {
          return current;
        }

        const nextModel = models.some((option) => option.id === current.model)
          ? current.model
          : getDefaultModelForProvider(activeProvider, models);

        return {
          ...current,
          model: nextModel,
          providerModels: {
            ...current.providerModels,
            [activeProvider]: models
          }
        };
      });

      setInfo(`Fetched ${models.length} ${activeProvider === 'groq' ? 'Groq' : 'OpenRouter'} models. Select one, then save.`);
      setSaveState('idle');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch models.');
    } finally {
      setModelLoadState('idle');
    }
  };

  const handleSave = async () => {
    setSaveState('saving');
    setError(null);
    setInfo(null);

    try {
      const nextSettings: AppSettings = {
        ...draftSettings,
        groqApiKey: draftSettings.groqApiKey.trim(),
        openrouterApiKey: draftSettings.openrouterApiKey.trim()
      };

      await saveSettings(nextSettings);
      setSavedSettings(nextSettings);
      setDraftSettings(nextSettings);
      setSaveState('saved');
      setInfo('Settings saved. The saved provider, key, and model will now be used for generation.');
      window.setTimeout(() => setSaveState('idle'), 1800);
    } catch (err: any) {
      setSaveState('idle');
      setError(err.message || 'Failed to save settings.');
    }
  };

  const providerLabel = activeProvider === 'groq' ? 'Groq' : 'OpenRouter';
  const savedStatus = savedSettings && hasSavedConfiguration(savedSettings);

  return (
    <div className="p-4 space-y-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Settings</h2>

      <div className={`rounded-md border px-3 py-2 text-sm ${savedStatus ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        {savedStatus
          ? `Saved config: ${savedSettings.provider} / ${savedSettings.model}`
          : 'No complete saved config yet. Fetch models, select one, then click Save.'}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">AI Provider</label>
        <select
          value={draftSettings.provider}
          onChange={(e) => handleProviderChange(e.target.value as ProviderId)}
          className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="groq">Groq</option>
          <option value="openrouter">OpenRouter</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{providerLabel} API Key</label>
        <input
          type="password"
          value={activeProvider === 'groq' ? draftSettings.groqApiKey : draftSettings.openrouterApiKey}
          onChange={(e) => setDraftField(activeProvider === 'groq' ? 'groqApiKey' : 'openrouterApiKey', e.target.value)}
          placeholder={activeProvider === 'groq' ? 'gsk_...' : 'sk-or-v1-...'}
          className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Model</label>
            <p className="text-xs text-gray-500">Fetch the live model list from {providerLabel} using the current API key.</p>
          </div>
          <button
            onClick={handleFetchModels}
            disabled={!canFetchModels || modelLoadState === 'loading'}
            className="inline-flex items-center gap-2 rounded border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {modelLoadState === 'loading' ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Fetch models
          </button>
        </div>

        <select
          value={draftSettings.model}
          onChange={(e) => setDraftField('model', e.target.value)}
          disabled={!availableModels.length}
          className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
        >
          {!availableModels.length ? (
            <option value="">Fetch models first</option>
          ) : (
            availableModels.map((model: ModelOption) => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.id})
              </option>
            ))
          )}
        </select>
      </div>

      {(error || info || hasUnsavedChanges) && (
        <div className="space-y-2">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              {info}
            </div>
          )}
          {hasUnsavedChanges && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              You have unsaved changes. Generation still uses the last saved provider settings until you click Save.
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!canSave}
        className="w-full inline-flex items-center justify-center gap-2 rounded bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
      >
        {saveState === 'saving' ? <LoaderCircle size={16} className="animate-spin" /> : saveState === 'saved' ? <Check size={16} /> : <Save size={16} />}
        {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save settings'}
      </button>

      <div className="pt-4 border-t space-y-2">
        <button
          onClick={async () => {
            if (confirm('Clear history?')) {
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
            if (confirm('Clear ALL data including settings and API keys?')) {
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
