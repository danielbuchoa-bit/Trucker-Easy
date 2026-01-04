import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { translations, Language } from './translations';

type Translations = typeof translations;
type TranslationsForLanguage = Translations[Language];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationsForLanguage;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // Try to get saved language from localStorage
    const saved = localStorage.getItem('truckereasy-language');
    if (saved && (saved === 'en' || saved === 'es' || saved === 'pt')) {
      return saved;
    }
    // Try to detect browser language
    const browserLang = navigator.language.slice(0, 2);
    if (browserLang === 'es') return 'es';
    if (browserLang === 'pt') return 'pt';
    return 'en';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('truckereasy-language', lang);
  }, []);

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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

// Language options for select components
export const languageOptions = [
  { value: 'en' as Language, label: 'English', flag: '🇺🇸' },
  { value: 'es' as Language, label: 'Español', flag: '🇲🇽' },
  { value: 'pt' as Language, label: 'Português', flag: '🇧🇷' },
];
