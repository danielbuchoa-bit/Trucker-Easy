import React from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { toast } from 'sonner';

/**
 * Always-visible floating button to quickly return to English.
 * Only shows when current language is NOT English.
 * One tap = instant switch to en-US.
 */
const EnglishQuickReturn: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  
  // Only show when NOT in English
  if (language === 'en') {
    return null;
  }

  const handleReturnToEnglish = () => {
    setLanguage('en');
    toast.success('Language set to English');
  };

  const handleLongPress = () => {
    // Safety fallback: long-press forces English
    handleReturnToEnglish();
  };

  return (
    <button
      onClick={handleReturnToEnglish}
      onContextMenu={(e) => {
        e.preventDefault();
        handleLongPress();
      }}
      className="fixed top-4 right-4 z-50 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-bold shadow-lg hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-1.5 safe-top"
      style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
      aria-label="Switch to English"
      title="Switch to English (long-press to force)"
    >
      <span className="text-base">🇺🇸</span>
      <span>EN</span>
    </button>
  );
};

export default EnglishQuickReturn;
