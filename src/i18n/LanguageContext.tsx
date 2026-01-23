import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo, useEffect } from 'react';
import { translations, Language } from './translations';

type Translations = typeof translations;
type TranslationsForLanguage = Translations[Language];

// Language option with display info
export interface LanguageOption {
  code: string;           // BCP-47 code (e.g., "en-US", "pt-BR")
  value: Language;        // Translation key to use (en, es, pt)
  label: string;          // English name
  nativeLabel: string;    // Native name
  flag: string;           // Emoji flag
  favorite?: boolean;     // Pin to top of list
  hasFullTranslation: boolean; // Whether this language has full translations
}

// Languages with FULL translations
const FULLY_TRANSLATED_LANGUAGES = ['en', 'es', 'pt'] as const;

// Master language list - marks which have full translations
export const MASTER_LANGUAGE_LIST: LanguageOption[] = [
  // === FULLY TRANSLATED (favorites) ===
  { code: 'en-US', value: 'en', label: 'English', nativeLabel: 'English', flag: '🇺🇸', favorite: true, hasFullTranslation: true },
  { code: 'es', value: 'es', label: 'Spanish', nativeLabel: 'Español', flag: '🇲🇽', favorite: true, hasFullTranslation: true },
  { code: 'pt-BR', value: 'pt', label: 'Portuguese', nativeLabel: 'Português', flag: '🇧🇷', favorite: true, hasFullTranslation: true },
  
  // === EUROPEAN LANGUAGES (fallback to English) ===
  { code: 'fr', value: 'en', label: 'French', nativeLabel: 'Français', flag: '🇫🇷', hasFullTranslation: false },
  { code: 'de', value: 'en', label: 'German', nativeLabel: 'Deutsch', flag: '🇩🇪', hasFullTranslation: false },
  { code: 'it', value: 'en', label: 'Italian', nativeLabel: 'Italiano', flag: '🇮🇹', hasFullTranslation: false },
  { code: 'nl', value: 'en', label: 'Dutch', nativeLabel: 'Nederlands', flag: '🇳🇱', hasFullTranslation: false },
  { code: 'sv', value: 'en', label: 'Swedish', nativeLabel: 'Svenska', flag: '🇸🇪', hasFullTranslation: false },
  { code: 'no', value: 'en', label: 'Norwegian', nativeLabel: 'Norsk', flag: '🇳🇴', hasFullTranslation: false },
  { code: 'da', value: 'en', label: 'Danish', nativeLabel: 'Dansk', flag: '🇩🇰', hasFullTranslation: false },
  { code: 'fi', value: 'en', label: 'Finnish', nativeLabel: 'Suomi', flag: '🇫🇮', hasFullTranslation: false },
  { code: 'is', value: 'en', label: 'Icelandic', nativeLabel: 'Íslenska', flag: '🇮🇸', hasFullTranslation: false },
  
  // === EASTERN EUROPEAN ===
  { code: 'pl', value: 'en', label: 'Polish', nativeLabel: 'Polski', flag: '🇵🇱', hasFullTranslation: false },
  { code: 'cs', value: 'en', label: 'Czech', nativeLabel: 'Čeština', flag: '🇨🇿', hasFullTranslation: false },
  { code: 'sk', value: 'en', label: 'Slovak', nativeLabel: 'Slovenčina', flag: '🇸🇰', hasFullTranslation: false },
  { code: 'hu', value: 'en', label: 'Hungarian', nativeLabel: 'Magyar', flag: '🇭🇺', hasFullTranslation: false },
  { code: 'ro', value: 'en', label: 'Romanian', nativeLabel: 'Română', flag: '🇷🇴', hasFullTranslation: false },
  { code: 'bg', value: 'en', label: 'Bulgarian', nativeLabel: 'Български', flag: '🇧🇬', hasFullTranslation: false },
  { code: 'el', value: 'en', label: 'Greek', nativeLabel: 'Ελληνικά', flag: '🇬🇷', hasFullTranslation: false },
  { code: 'lt', value: 'en', label: 'Lithuanian', nativeLabel: 'Lietuvių', flag: '🇱🇹', hasFullTranslation: false },
  { code: 'lv', value: 'en', label: 'Latvian', nativeLabel: 'Latviešu', flag: '🇱🇻', hasFullTranslation: false },
  { code: 'et', value: 'en', label: 'Estonian', nativeLabel: 'Eesti', flag: '🇪🇪', hasFullTranslation: false },
  
  // === SLAVIC ===
  { code: 'ru', value: 'en', label: 'Russian', nativeLabel: 'Русский', flag: '🇷🇺', hasFullTranslation: false },
  { code: 'uk', value: 'en', label: 'Ukrainian', nativeLabel: 'Українська', flag: '🇺🇦', hasFullTranslation: false },
  { code: 'be', value: 'en', label: 'Belarusian', nativeLabel: 'Беларуская', flag: '🇧🇾', hasFullTranslation: false },
  { code: 'sr', value: 'en', label: 'Serbian', nativeLabel: 'Српски', flag: '🇷🇸', hasFullTranslation: false },
  { code: 'hr', value: 'en', label: 'Croatian', nativeLabel: 'Hrvatski', flag: '🇭🇷', hasFullTranslation: false },
  { code: 'sl', value: 'en', label: 'Slovenian', nativeLabel: 'Slovenščina', flag: '🇸🇮', hasFullTranslation: false },
  { code: 'bs', value: 'en', label: 'Bosnian', nativeLabel: 'Bosanski', flag: '🇧🇦', hasFullTranslation: false },
  { code: 'mk', value: 'en', label: 'Macedonian', nativeLabel: 'Македонски', flag: '🇲🇰', hasFullTranslation: false },
  
  // === MIDDLE EASTERN / CENTRAL ASIAN ===
  { code: 'tr', value: 'en', label: 'Turkish', nativeLabel: 'Türkçe', flag: '🇹🇷', hasFullTranslation: false },
  { code: 'ar', value: 'en', label: 'Arabic', nativeLabel: 'العربية', flag: '🇸🇦', hasFullTranslation: false },
  { code: 'he', value: 'en', label: 'Hebrew', nativeLabel: 'עברית', flag: '🇮🇱', hasFullTranslation: false },
  { code: 'fa', value: 'en', label: 'Persian', nativeLabel: 'فارسی', flag: '🇮🇷', hasFullTranslation: false },
  { code: 'ur', value: 'en', label: 'Urdu', nativeLabel: 'اردو', flag: '🇵🇰', hasFullTranslation: false },
  { code: 'kk', value: 'en', label: 'Kazakh', nativeLabel: 'Қазақ', flag: '🇰🇿', hasFullTranslation: false },
  { code: 'uz', value: 'en', label: 'Uzbek', nativeLabel: 'Oʻzbek', flag: '🇺🇿', hasFullTranslation: false },
  { code: 'az', value: 'en', label: 'Azerbaijani', nativeLabel: 'Azərbaycan', flag: '🇦🇿', hasFullTranslation: false },
  { code: 'ka', value: 'en', label: 'Georgian', nativeLabel: 'ქართული', flag: '🇬🇪', hasFullTranslation: false },
  { code: 'hy', value: 'en', label: 'Armenian', nativeLabel: 'Հայdelays', flag: '🇦🇲', hasFullTranslation: false },
  
  // === SOUTH ASIAN ===
  { code: 'hi', value: 'en', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳', hasFullTranslation: false },
  { code: 'bn', value: 'en', label: 'Bengali', nativeLabel: 'বাংলা', flag: '🇧🇩', hasFullTranslation: false },
  { code: 'pa', value: 'en', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', flag: '🇮🇳', hasFullTranslation: false },
  { code: 'gu', value: 'en', label: 'Gujarati', nativeLabel: 'ગુજરાતી', flag: '🇮🇳', hasFullTranslation: false },
  { code: 'ta', value: 'en', label: 'Tamil', nativeLabel: 'தமிழ்', flag: '🇮🇳', hasFullTranslation: false },
  { code: 'te', value: 'en', label: 'Telugu', nativeLabel: 'తెలుగు', flag: '🇮🇳', hasFullTranslation: false },
  { code: 'ml', value: 'en', label: 'Malayalam', nativeLabel: 'മലയാളം', flag: '🇮🇳', hasFullTranslation: false },
  { code: 'mr', value: 'en', label: 'Marathi', nativeLabel: 'मराठी', flag: '🇮🇳', hasFullTranslation: false },
  { code: 'kn', value: 'en', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', flag: '🇮🇳', hasFullTranslation: false },
  { code: 'ne', value: 'en', label: 'Nepali', nativeLabel: 'नेपाली', flag: '🇳🇵', hasFullTranslation: false },
  { code: 'si', value: 'en', label: 'Sinhala', nativeLabel: 'සිංහල', flag: '🇱🇰', hasFullTranslation: false },
  
  // === EAST ASIAN ===
  { code: 'zh-CN', value: 'en', label: 'Chinese (Simplified)', nativeLabel: '简体中文', flag: '🇨🇳', hasFullTranslation: false },
  { code: 'zh-TW', value: 'en', label: 'Chinese (Traditional)', nativeLabel: '繁體中文', flag: '🇹🇼', hasFullTranslation: false },
  { code: 'ja', value: 'en', label: 'Japanese', nativeLabel: '日本語', flag: '🇯🇵', hasFullTranslation: false },
  { code: 'ko', value: 'en', label: 'Korean', nativeLabel: '한국어', flag: '🇰🇷', hasFullTranslation: false },
  { code: 'mn', value: 'en', label: 'Mongolian', nativeLabel: 'Монгол', flag: '🇲🇳', hasFullTranslation: false },
  
  // === SOUTHEAST ASIAN ===
  { code: 'vi', value: 'en', label: 'Vietnamese', nativeLabel: 'Tiếng Việt', flag: '🇻🇳', hasFullTranslation: false },
  { code: 'th', value: 'en', label: 'Thai', nativeLabel: 'ไทย', flag: '🇹🇭', hasFullTranslation: false },
  { code: 'id', value: 'en', label: 'Indonesian', nativeLabel: 'Bahasa Indonesia', flag: '🇮🇩', hasFullTranslation: false },
  { code: 'ms', value: 'en', label: 'Malay', nativeLabel: 'Bahasa Melayu', flag: '🇲🇾', hasFullTranslation: false },
  { code: 'tl', value: 'en', label: 'Filipino', nativeLabel: 'Filipino', flag: '🇵🇭', hasFullTranslation: false },
  { code: 'my', value: 'en', label: 'Burmese', nativeLabel: 'မြန်မာ', flag: '🇲🇲', hasFullTranslation: false },
  { code: 'km', value: 'en', label: 'Khmer', nativeLabel: 'ខ្មែរ', flag: '🇰🇭', hasFullTranslation: false },
  { code: 'lo', value: 'en', label: 'Lao', nativeLabel: 'ລາວ', flag: '🇱🇦', hasFullTranslation: false },
  
  // === AFRICAN ===
  { code: 'sw', value: 'en', label: 'Swahili', nativeLabel: 'Kiswahili', flag: '🇰🇪', hasFullTranslation: false },
  { code: 'am', value: 'en', label: 'Amharic', nativeLabel: 'አማርኛ', flag: '🇪🇹', hasFullTranslation: false },
  { code: 'ha', value: 'en', label: 'Hausa', nativeLabel: 'Hausa', flag: '🇳🇬', hasFullTranslation: false },
  { code: 'yo', value: 'en', label: 'Yoruba', nativeLabel: 'Yorùbá', flag: '🇳🇬', hasFullTranslation: false },
  { code: 'ig', value: 'en', label: 'Igbo', nativeLabel: 'Igbo', flag: '🇳🇬', hasFullTranslation: false },
  { code: 'zu', value: 'en', label: 'Zulu', nativeLabel: 'isiZulu', flag: '🇿🇦', hasFullTranslation: false },
  { code: 'af', value: 'en', label: 'Afrikaans', nativeLabel: 'Afrikaans', flag: '🇿🇦', hasFullTranslation: false },
  
  // === REGIONAL VARIANTS ===
  { code: 'ht', value: 'en', label: 'Haitian Creole', nativeLabel: 'Kreyòl Ayisyen', flag: '🇭🇹', hasFullTranslation: false },
  { code: 'pt-PT', value: 'pt', label: 'Portuguese (Portugal)', nativeLabel: 'Português (Portugal)', flag: '🇵🇹', hasFullTranslation: true },
  { code: 'es-ES', value: 'es', label: 'Spanish (Spain)', nativeLabel: 'Español (España)', flag: '🇪🇸', hasFullTranslation: true },
  { code: 'en-GB', value: 'en', label: 'English (UK)', nativeLabel: 'English (UK)', flag: '🇬🇧', hasFullTranslation: true },
  { code: 'en-CA', value: 'en', label: 'English (Canada)', nativeLabel: 'English (Canada)', flag: '🇨🇦', hasFullTranslation: true },
  { code: 'fr-CA', value: 'en', label: 'French (Canada)', nativeLabel: 'Français (Canada)', flag: '🇨🇦', hasFullTranslation: false },
];

interface LanguageContextType {
  language: Language;
  languageCode: string;
  setLanguage: (code: string) => void;
  t: TranslationsForLanguage;
  availableLanguages: LanguageOption[];
  favoriteLanguages: LanguageOption[];
  otherLanguages: LanguageOption[];
  currentLanguageOption: LanguageOption | undefined;
  debugInfo: { code: string; translationKey: Language; sampleKey: string };
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

// Helper to find language option by code
const findLanguageByCode = (code: string): LanguageOption | undefined => {
  return MASTER_LANGUAGE_LIST.find(lang => lang.code === code);
};

// Normalize locale code to match our list
export const normalizeLocale = (code: string): string => {
  // Direct match
  const direct = MASTER_LANGUAGE_LIST.find(l => l.code === code);
  if (direct) return direct.code;
  
  // Try lowercase match
  const lower = MASTER_LANGUAGE_LIST.find(l => l.code.toLowerCase() === code.toLowerCase());
  if (lower) return lower.code;
  
  // Try prefix match (e.g., "en" -> "en-US")
  const prefix = code.slice(0, 2).toLowerCase();
  const prefixMatch = MASTER_LANGUAGE_LIST.find(l => l.code.toLowerCase().startsWith(prefix));
  if (prefixMatch) return prefixMatch.code;
  
  return 'en-US'; // Default fallback
};

// Helper to detect supported language from browser
const detectBrowserLanguage = (): string => {
  const browserLang = navigator.language;
  return normalizeLocale(browserLang);
};

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [languageCode, setLanguageCodeState] = useState<string>(() => {
    // Priority: 1) Manual selection, 2) Profile preference (future), 3) Device locale, 4) en-US
    const saved = localStorage.getItem('truckereasy-language-code');
    if (saved && findLanguageByCode(saved)) {
      return saved;
    }
    return detectBrowserLanguage();
  });

  // Get the translation key (en, es, pt) from the language code
  const language = useMemo((): Language => {
    const langOption = findLanguageByCode(languageCode);
    return langOption?.value || 'en';
  }, [languageCode]);

  const currentLanguageOption = useMemo(() => {
    return findLanguageByCode(languageCode);
  }, [languageCode]);

  const setLanguage = useCallback((code: string) => {
    const normalizedCode = normalizeLocale(code);
    const langOption = findLanguageByCode(normalizedCode);
    
    if (langOption) {
      // Debug logging
      console.log('[i18n] Language change requested:', {
        inputCode: code,
        normalizedCode,
        translationKey: langOption.value,
        hasFullTranslation: langOption.hasFullTranslation,
        previousCode: languageCode,
      });
      
      setLanguageCodeState(normalizedCode);
      localStorage.setItem('truckereasy-language-code', normalizedCode);
      
      // Log after state update
      console.log('[i18n] Language changed to:', {
        code: normalizedCode,
        translationKey: langOption.value,
        sampleTranslation: translations[langOption.value]?.settings?.language || 'N/A',
      });
    }
  }, [languageCode]);

  // Get translations with English fallback for missing keys
  const t = useMemo(() => {
    const currentTranslations = translations[language];
    const fallbackTranslations = translations['en'];
    
    // Deep merge with fallback - proxy approach for nested objects
    const createProxy = (current: any, fallback: any): any => {
      return new Proxy(current || {}, {
        get(target, prop) {
          const value = target[prop as keyof typeof target];
          const fallbackValue = fallback?.[prop as keyof typeof fallback];
          
          if (value === undefined) {
            return fallbackValue;
          }
          
          // If both are objects, create nested proxy
          if (typeof value === 'object' && value !== null && typeof fallbackValue === 'object') {
            return createProxy(value, fallbackValue);
          }
          
          return value;
        }
      });
    };
    
    return createProxy(currentTranslations, fallbackTranslations) as TranslationsForLanguage;
  }, [language]);

  // Debug info for UI display
  const debugInfo = useMemo(() => ({
    code: languageCode,
    translationKey: language,
    sampleKey: t.settings?.language || 'Language',
  }), [languageCode, language, t]);

  // Log on mount and language changes
  useEffect(() => {
    console.log('[i18n] Current state:', {
      languageCode,
      translationKey: language,
      hasFullTranslation: currentLanguageOption?.hasFullTranslation,
      sampleTranslations: {
        settings: t.settings?.title,
        language: t.settings?.language,
        profile: t.profile?.title,
      }
    });
  }, [languageCode, language, currentLanguageOption, t]);

  // Split languages into favorites and others (sorted alphabetically)
  const { favoriteLanguages, otherLanguages } = useMemo(() => {
    const favorites = MASTER_LANGUAGE_LIST.filter(l => l.favorite);
    const others = MASTER_LANGUAGE_LIST
      .filter(l => !l.favorite)
      .sort((a, b) => a.label.localeCompare(b.label));
    return { favoriteLanguages: favorites, otherLanguages: others };
  }, []);

  return (
    <LanguageContext.Provider value={{ 
      language, 
      languageCode,
      setLanguage, 
      t, 
      availableLanguages: MASTER_LANGUAGE_LIST,
      favoriteLanguages,
      otherLanguages,
      currentLanguageOption,
      debugInfo,
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
export const languageOptions = MASTER_LANGUAGE_LIST.filter(l => l.favorite);
