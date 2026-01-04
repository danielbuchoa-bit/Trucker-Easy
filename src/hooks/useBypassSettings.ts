import { useState, useEffect } from 'react';

interface BypassSettings {
  enableReminder: boolean;
  saveHistory: boolean;
}

const STORAGE_KEY = 'bypass_settings';

const defaultSettings: BypassSettings = {
  enableReminder: true,
  saveHistory: true,
};

export const useBypassSettings = () => {
  const [settings, setSettings] = useState<BypassSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (updates: Partial<BypassSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  return { settings, updateSettings };
};
