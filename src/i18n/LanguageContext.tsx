import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';
import { translations, Language } from './translations';

type Translations = typeof translations;
type TranslationsForLanguage = Translations[Language];

// Complete list of available languages from Logbook configuration
// This can be extended as more translations are added
export interface LanguageOption {
  value: Language;
  label: string;       // Display name in English
  nativeLabel: string; // Display name in native language
  flag: string;
  region?: string;     // e.g., "US", "BR", "MX"
}

// All available languages - dynamically expandable
// Currently supported with full translations: en, es, pt
// Others show English fallback but are ready for translation
export const ALL_AVAILABLE_LANGUAGES: LanguageOption[] = [
  { value: 'en', label: 'English', nativeLabel: 'English', flag: '🇺🇸', region: 'US' },
  { value: 'es', label: 'Spanish', nativeLabel: 'Español', flag: '🇲🇽', region: 'US' },
  { value: 'pt', label: 'Portuguese', nativeLabel: 'Português', flag: '🇧🇷', region: 'BR' },
];

// Extended language list for future Logbook integration
// These will use English fallback until translations are added
export const LOGBOOK_EXTENDED_LANGUAGES: LanguageOption[] = [
  ...ALL_AVAILABLE_LANGUAGES,
  { value: 'en', label: 'Russian', nativeLabel: 'Русский', flag: '🇷🇺', region: 'RU' },
  { value: 'en', label: 'Ukrainian', nativeLabel: 'Українська', flag: '🇺🇦', region: 'UA' },
  { value: 'en', label: 'Polish', nativeLabel: 'Polski', flag: '🇵🇱', region: 'PL' },
  { value: 'en', label: 'French', nativeLabel: 'Français', flag: '🇫🇷', region: 'FR' },
  { value: 'en', label: 'German', nativeLabel: 'Deutsch', flag: '🇩🇪', region: 'DE' },
  { value: 'en', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳', region: 'IN' },
  { value: 'en', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', flag: '🇮🇳', region: 'IN' },
  { value: 'en', label: 'Vietnamese', nativeLabel: 'Tiếng Việt', flag: '🇻🇳', region: 'VN' },
  { value: 'en', label: 'Chinese', nativeLabel: '中文', flag: '🇨🇳', region: 'CN' },
  { value: 'en', label: 'Korean', nativeLabel: '한국어', flag: '🇰🇷', region: 'KR' },
  { value: 'en', label: 'Arabic', nativeLabel: 'العربية', flag: '🇸🇦', region: 'SA' },
  { value: 'en', label: 'Haitian Creole', nativeLabel: 'Kreyòl Ayisyen', flag: '🇭🇹', region: 'HT' },
];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationsForLanguage;
  availableLanguages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

// Helper to detect supported language from browser
const detectBrowserLanguage = (): Language => {
  const browserLang = navigator.language.slice(0, 2).toLowerCase();
  if (browserLang === 'es') return 'es';
  if (browserLang === 'pt') return 'pt';
  return 'en'; // Default fallback
};

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // Priority: 1) Manual selection, 2) Profile preference, 3) Device locale, 4) en-US
    const saved = localStorage.getItem('truckereasy-language');
    if (saved && (saved === 'en' || saved === 'es' || saved === 'pt')) {
      return saved as Language;
    }
    return detectBrowserLanguage();
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('truckereasy-language', lang);
    // Future: Sync to driver profile when authenticated
    // syncLanguageToProfile(lang);
  }, []);

  // Get translations with English fallback for missing keys
  const t = useMemo(() => {
    const currentTranslations = translations[language];
    const fallbackTranslations = translations['en'];
    
    // Deep merge with fallback
    return new Proxy(currentTranslations, {
      get(target, prop) {
        const value = target[prop as keyof typeof target];
        if (value === undefined) {
          return fallbackTranslations[prop as keyof typeof fallbackTranslations];
        }
        return value;
      }
    }) as TranslationsForLanguage;
  }, [language]);

  // Available languages (currently supported with translations)
  const availableLanguages = useMemo(() => {
    // English always first, then alphabetically by label
    const sorted = [...ALL_AVAILABLE_LANGUAGES].sort((a, b) => {
      if (a.value === 'en') return -1;
      if (b.value === 'en') return 1;
      return a.label.localeCompare(b.label);
    });
    return sorted;
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, availableLanguages }}>
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
export const languageOptions = ALL_AVAILABLE_LANGUAGES;
