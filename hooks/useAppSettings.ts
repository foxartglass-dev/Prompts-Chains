import { useState, useEffect } from 'react';
import { AppSettings } from '../types.ts';

const STORAGE_KEY = 'promptFlowSettings';

const getDefaultSettings = (): AppSettings => ({
  zeroGpt: {
    enabled: true,
    apiKey: '',
    threshold: 40,
    maxRetries: 1,
    retryStepId: undefined,
    onFlagged: 'include_with_flag',
  },
  wordpress: {
    connections: [],
    defaultConnection: undefined,
    defaultPostType: 'posts',
    defaultStatus: 'publish',
    titleTemplate: 'An Introduction to {item_name}',
    fieldMapping: {},
    retries: 2,
    retryDelay: 2000,
  },
  execution: {
    concurrency: 1,
    batchSize: 10,
    batchDelay: 0,
    timeout: 60000,
    logVerbosity: 'normal',
    stopOnError: false,
    providerRetry: {
      enabled: true,
      maxAttempts: 3,
      backoffMs: 1000,
    },
  },
  providers: {
    defaultProvider: 'gemini',
    apiKeys: {
      gemini: '',
      claude: '',
      openai: '',
    },
    modelOverrides: {
      gemini: 'gemini-2.5-flash',
      claude: 'claude-3-sonnet-20240229',
      openai: 'gpt-4',
    },
    perStepProviders: {},
  },
  files: {
    nameTemplate: '{tag}-{item_name}-output',
    formats: {
      txt: true,
      json: true,
      csv: false,
    },
    zipCompression: true,
  },
});

const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings());

  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem(STORAGE_KEY);
      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings);
        setSettings(parsedSettings);
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
      // Fallback to defaults on error
      setSettings(getDefaultSettings());
    }
  }, []);

  const saveSettingsToStorage = (updatedSettings: AppSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSettings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  };

  const updateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettingsToStorage(newSettings);
  };

  const resetSettings = () => {
    const defaults = getDefaultSettings();
    setSettings(defaults);
    saveSettingsToStorage(defaults);
  };

  return {
    settings,
    updateSettings,
    resetSettings,
  };
};

export default useAppSettings;
