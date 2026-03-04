import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo, useEffect } from 'react';
import { translations, Language } from './translations';

type Translations = typeof translations;
type TranslationsForLanguage = Translations['en'];

// Simple language option for all supported languages
export interface LanguageOption {
  code: string;
  value: Language;
  label: string;
  nativeLabel: string;
  flag: string;
}

// All supported languages
export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en-US', value: 'en', label: 'English', nativeLabel: 'English', flag: '🇺🇸' },
  { code: 'es', value: 'es', label: 'Spanish', nativeLabel: 'Español', flag: '🇲🇽' },
  { code: 'pt-BR', value: 'pt', label: 'Portuguese', nativeLabel: 'Português', flag: '🇧🇷' },
  { code: 'de', value: 'de', label: 'German', nativeLabel: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', value: 'fr', label: 'French', nativeLabel: 'Français', flag: '🇫🇷' },
  { code: 'hi', value: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳' },
];

interface LanguageContextType {
  language: Language;
  languageCode: string;
  setLanguage: (code: string) => void;
  t: TranslationsForLanguage;
  availableLanguages: LanguageOption[];
  currentLanguageOption: LanguageOption | undefined;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

// Helper to find language option by code or value
const findLanguage = (codeOrValue: string): LanguageOption | undefined => {
  return SUPPORTED_LANGUAGES.find(lang => 
    lang.code === codeOrValue || 
    lang.value === codeOrValue ||
    lang.code.toLowerCase() === codeOrValue.toLowerCase()
  );
};

// Normalize any locale to one of our supported languages
const normalizeToSupported = (code: string): Language => {
  const direct = findLanguage(code);
  if (direct) return direct.value;
  
  const prefix = code.slice(0, 2).toLowerCase();
  if (prefix === 'pt') return 'pt';
  if (prefix === 'es') return 'es';
  if (prefix === 'de') return 'de';
  if (prefix === 'fr') return 'fr';
  if (prefix === 'hi') return 'hi';
  
  return 'en';
};

// Deep merge: overlay partial translations on top of English fallback
function deepMerge(base: any, overlay: any): any {
  if (!overlay) return base;
  const result = { ...base };
  for (const key of Object.keys(base)) {
    if (key in overlay) {
      if (typeof base[key] === 'object' && base[key] !== null && !Array.isArray(base[key])) {
        result[key] = deepMerge(base[key], overlay[key]);
      } else {
        result[key] = overlay[key];
      }
    }
  }
  return result;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  // Default to English, only change after user explicitly selects
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('truckereasy-language');
    const validLangs: Language[] = ['en', 'es', 'pt', 'de', 'fr', 'hi'];
    if (saved && validLangs.includes(saved as Language)) {
      return saved as Language;
    }
    return 'en';
  });

  const languageCode = useMemo(() => {
    const option = SUPPORTED_LANGUAGES.find(l => l.value === language);
    return option?.code || 'en-US';
  }, [language]);

  const currentLanguageOption = useMemo(() => {
    return SUPPORTED_LANGUAGES.find(l => l.value === language);
  }, [language]);

  const setLanguage = useCallback((codeOrValue: string) => {
    const normalized = normalizeToSupported(codeOrValue);
    console.log('[i18n] Language changed:', codeOrValue, '->', normalized);
    setLanguageState(normalized);
    localStorage.setItem('truckereasy-language', normalized);
  }, []);

  // Get translations with English fallback for incomplete languages
  const t = useMemo((): TranslationsForLanguage => {
    const langTranslations = translations[language];
    if (language === 'en') return langTranslations;
    return deepMerge(translations.en, langTranslations) as TranslationsForLanguage;
  }, [language]);

  // Log on mount
  useEffect(() => {
    console.log('[i18n] Current language:', language);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ 
      language, 
      languageCode,
      setLanguage, 
      t, 
      availableLanguages: SUPPORTED_LANGUAGES,
      currentLanguageOption,
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Legacy export for backward compatibility
export const languageOptions = SUPPORTED_LANGUAGES;

// Re-export for components that need the type
export type { Language };
