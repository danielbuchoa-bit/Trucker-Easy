import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';
import { translations, Language } from './translations';

type Translations = typeof translations;
type TranslationsForLanguage = Translations[Language];

// Language option with display info
export interface LanguageOption {
  code: string;           // BCP-47 code (e.g., "en-US", "pt-BR")
  value: Language;        // Translation key to use (en, es, pt - falls back to en)
  label: string;          // English name
  nativeLabel: string;    // Native name
  flag: string;           // Emoji flag
  favorite?: boolean;     // Pin to top of list
}

// Master language list - 60+ languages
// Languages with full translations use their own value, others fallback to 'en'
export const MASTER_LANGUAGE_LIST: LanguageOption[] = [
  // === FAVORITES (pinned to top) ===
  { code: 'en-US', value: 'en', label: 'English', nativeLabel: 'English', flag: '🇺🇸', favorite: true },
  { code: 'es', value: 'es', label: 'Spanish', nativeLabel: 'Español', flag: '🇲🇽', favorite: true },
  { code: 'pt-BR', value: 'pt', label: 'Portuguese', nativeLabel: 'Português', flag: '🇧🇷', favorite: true },
  
  // === EUROPEAN LANGUAGES ===
  { code: 'fr', value: 'en', label: 'French', nativeLabel: 'Français', flag: '🇫🇷' },
  { code: 'de', value: 'en', label: 'German', nativeLabel: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', value: 'en', label: 'Italian', nativeLabel: 'Italiano', flag: '🇮🇹' },
  { code: 'nl', value: 'en', label: 'Dutch', nativeLabel: 'Nederlands', flag: '🇳🇱' },
  { code: 'sv', value: 'en', label: 'Swedish', nativeLabel: 'Svenska', flag: '🇸🇪' },
  { code: 'no', value: 'en', label: 'Norwegian', nativeLabel: 'Norsk', flag: '🇳🇴' },
  { code: 'da', value: 'en', label: 'Danish', nativeLabel: 'Dansk', flag: '🇩🇰' },
  { code: 'fi', value: 'en', label: 'Finnish', nativeLabel: 'Suomi', flag: '🇫🇮' },
  { code: 'is', value: 'en', label: 'Icelandic', nativeLabel: 'Íslenska', flag: '🇮🇸' },
  
  // === EASTERN EUROPEAN ===
  { code: 'pl', value: 'en', label: 'Polish', nativeLabel: 'Polski', flag: '🇵🇱' },
  { code: 'cs', value: 'en', label: 'Czech', nativeLabel: 'Čeština', flag: '🇨🇿' },
  { code: 'sk', value: 'en', label: 'Slovak', nativeLabel: 'Slovenčina', flag: '🇸🇰' },
  { code: 'hu', value: 'en', label: 'Hungarian', nativeLabel: 'Magyar', flag: '🇭🇺' },
  { code: 'ro', value: 'en', label: 'Romanian', nativeLabel: 'Română', flag: '🇷🇴' },
  { code: 'bg', value: 'en', label: 'Bulgarian', nativeLabel: 'Български', flag: '🇧🇬' },
  { code: 'el', value: 'en', label: 'Greek', nativeLabel: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'lt', value: 'en', label: 'Lithuanian', nativeLabel: 'Lietuvių', flag: '🇱🇹' },
  { code: 'lv', value: 'en', label: 'Latvian', nativeLabel: 'Latviešu', flag: '🇱🇻' },
  { code: 'et', value: 'en', label: 'Estonian', nativeLabel: 'Eesti', flag: '🇪🇪' },
  
  // === SLAVIC ===
  { code: 'ru', value: 'en', label: 'Russian', nativeLabel: 'Русский', flag: '🇷🇺' },
  { code: 'uk', value: 'en', label: 'Ukrainian', nativeLabel: 'Українська', flag: '🇺🇦' },
  { code: 'be', value: 'en', label: 'Belarusian', nativeLabel: 'Беларуская', flag: '🇧🇾' },
  { code: 'sr', value: 'en', label: 'Serbian', nativeLabel: 'Српски', flag: '🇷🇸' },
  { code: 'hr', value: 'en', label: 'Croatian', nativeLabel: 'Hrvatski', flag: '🇭🇷' },
  { code: 'sl', value: 'en', label: 'Slovenian', nativeLabel: 'Slovenščina', flag: '🇸🇮' },
  { code: 'bs', value: 'en', label: 'Bosnian', nativeLabel: 'Bosanski', flag: '🇧🇦' },
  { code: 'mk', value: 'en', label: 'Macedonian', nativeLabel: 'Македонски', flag: '🇲🇰' },
  
  // === MIDDLE EASTERN / CENTRAL ASIAN ===
  { code: 'tr', value: 'en', label: 'Turkish', nativeLabel: 'Türkçe', flag: '🇹🇷' },
  { code: 'ar', value: 'en', label: 'Arabic', nativeLabel: 'العربية', flag: '🇸🇦' },
  { code: 'he', value: 'en', label: 'Hebrew', nativeLabel: 'עברית', flag: '🇮🇱' },
  { code: 'fa', value: 'en', label: 'Persian', nativeLabel: 'فارسی', flag: '🇮🇷' },
  { code: 'ur', value: 'en', label: 'Urdu', nativeLabel: 'اردو', flag: '🇵🇰' },
  { code: 'kk', value: 'en', label: 'Kazakh', nativeLabel: 'Қазақ', flag: '🇰🇿' },
  { code: 'uz', value: 'en', label: 'Uzbek', nativeLabel: 'Oʻzbek', flag: '🇺🇿' },
  { code: 'az', value: 'en', label: 'Azerbaijani', nativeLabel: 'Azərbaycan', flag: '🇦🇿' },
  { code: 'ka', value: 'en', label: 'Georgian', nativeLabel: 'ქართული', flag: '🇬🇪' },
  { code: 'hy', value: 'en', label: 'Armenian', nativeLabel: 'Հայերեdelays', flag: '🇦🇲' },
  
  // === SOUTH ASIAN ===
  { code: 'hi', value: 'en', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳' },
  { code: 'bn', value: 'en', label: 'Bengali', nativeLabel: 'বাংলা', flag: '🇧🇩' },
  { code: 'pa', value: 'en', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'gu', value: 'en', label: 'Gujarati', nativeLabel: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'ta', value: 'en', label: 'Tamil', nativeLabel: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', value: 'en', label: 'Telugu', nativeLabel: 'తెలుగు', flag: '🇮🇳' },
  { code: 'ml', value: 'en', label: 'Malayalam', nativeLabel: 'മലയാളം', flag: '🇮🇳' },
  { code: 'mr', value: 'en', label: 'Marathi', nativeLabel: 'मराठी', flag: '🇮🇳' },
  { code: 'kn', value: 'en', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ne', value: 'en', label: 'Nepali', nativeLabel: 'नेपाली', flag: '🇳🇵' },
  { code: 'si', value: 'en', label: 'Sinhala', nativeLabel: 'සිංහල', flag: '🇱🇰' },
  
  // === EAST ASIAN ===
  { code: 'zh-CN', value: 'en', label: 'Chinese (Simplified)', nativeLabel: '简体中文', flag: '🇨🇳' },
  { code: 'zh-TW', value: 'en', label: 'Chinese (Traditional)', nativeLabel: '繁體中文', flag: '🇹🇼' },
  { code: 'ja', value: 'en', label: 'Japanese', nativeLabel: '日本語', flag: '🇯🇵' },
  { code: 'ko', value: 'en', label: 'Korean', nativeLabel: '한국어', flag: '🇰🇷' },
  { code: 'mn', value: 'en', label: 'Mongolian', nativeLabel: 'Монгол', flag: '🇲🇳' },
  
  // === SOUTHEAST ASIAN ===
  { code: 'vi', value: 'en', label: 'Vietnamese', nativeLabel: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'th', value: 'en', label: 'Thai', nativeLabel: 'ไทย', flag: '🇹🇭' },
  { code: 'id', value: 'en', label: 'Indonesian', nativeLabel: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ms', value: 'en', label: 'Malay', nativeLabel: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'tl', value: 'en', label: 'Filipino', nativeLabel: 'Filipino', flag: '🇵🇭' },
  { code: 'my', value: 'en', label: 'Burmese', nativeLabel: 'မြန်မာ', flag: '🇲🇲' },
  { code: 'km', value: 'en', label: 'Khmer', nativeLabel: 'ខ្មែរ', flag: '🇰🇭' },
  { code: 'lo', value: 'en', label: 'Lao', nativeLabel: 'ລາວ', flag: '🇱🇦' },
  
  // === AFRICAN ===
  { code: 'sw', value: 'en', label: 'Swahili', nativeLabel: 'Kiswahili', flag: '🇰🇪' },
  { code: 'am', value: 'en', label: 'Amharic', nativeLabel: 'አማርኛ', flag: '🇪🇹' },
  { code: 'ha', value: 'en', label: 'Hausa', nativeLabel: 'Hausa', flag: '🇳🇬' },
  { code: 'yo', value: 'en', label: 'Yoruba', nativeLabel: 'Yorùbá', flag: '🇳🇬' },
  { code: 'ig', value: 'en', label: 'Igbo', nativeLabel: 'Igbo', flag: '🇳🇬' },
  { code: 'zu', value: 'en', label: 'Zulu', nativeLabel: 'isiZulu', flag: '🇿🇦' },
  { code: 'af', value: 'en', label: 'Afrikaans', nativeLabel: 'Afrikaans', flag: '🇿🇦' },
  
  // === CARIBBEAN / OTHER ===
  { code: 'ht', value: 'en', label: 'Haitian Creole', nativeLabel: 'Kreyòl Ayisyen', flag: '🇭🇹' },
  { code: 'pt-PT', value: 'pt', label: 'Portuguese (Portugal)', nativeLabel: 'Português (Portugal)', flag: '🇵🇹' },
  { code: 'es-ES', value: 'es', label: 'Spanish (Spain)', nativeLabel: 'Español (España)', flag: '🇪🇸' },
  { code: 'en-GB', value: 'en', label: 'English (UK)', nativeLabel: 'English (UK)', flag: '🇬🇧' },
  { code: 'en-CA', value: 'en', label: 'English (Canada)', nativeLabel: 'English (Canada)', flag: '🇨🇦' },
  { code: 'fr-CA', value: 'en', label: 'French (Canada)', nativeLabel: 'Français (Canada)', flag: '🇨🇦' },
];

interface LanguageContextType {
  language: Language;
  languageCode: string;
  setLanguage: (code: string) => void;
  t: TranslationsForLanguage;
  availableLanguages: LanguageOption[];
  favoriteLanguages: LanguageOption[];
  otherLanguages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

// Helper to find language option by code
const findLanguageByCode = (code: string): LanguageOption | undefined => {
  return MASTER_LANGUAGE_LIST.find(lang => lang.code === code);
};

// Helper to detect supported language from browser
const detectBrowserLanguage = (): string => {
  const browserLang = navigator.language;
  // Try exact match first
  const exactMatch = MASTER_LANGUAGE_LIST.find(l => l.code === browserLang);
  if (exactMatch) return exactMatch.code;
  
  // Try prefix match (e.g., "en" matches "en-US")
  const prefix = browserLang.slice(0, 2).toLowerCase();
  const prefixMatch = MASTER_LANGUAGE_LIST.find(l => l.code.toLowerCase().startsWith(prefix));
  if (prefixMatch) return prefixMatch.code;
  
  return 'en-US'; // Default fallback
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

  const setLanguage = useCallback((code: string) => {
    const langOption = findLanguageByCode(code);
    if (langOption) {
      setLanguageCodeState(code);
      localStorage.setItem('truckereasy-language-code', code);
      // Future: Sync to driver profile when authenticated
      // syncLanguageToProfile(code);
    }
  }, []);

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
      otherLanguages
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
