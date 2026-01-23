import React from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { toast } from 'sonner';

interface EnglishQuickReturnProps {
  variant?: 'inline' | 'floating';
  className?: string;
}

/**
 * Button to quickly return to English.
 * - inline: For use inside headers (default)
 * - floating: Fixed position overlay
 * Only shows when current language is NOT English.
 */
const EnglishQuickReturn: React.FC<EnglishQuickReturnProps> = ({ 
  variant = 'inline',
  className = '' 
}) => {
  const { language, setLanguage } = useLanguage();
  
  // Only show when NOT in English
  if (language === 'en') {
    return null;
  }

  const handleReturnToEnglish = () => {
    setLanguage('en');
    toast.success('Language set to English');
  };

  if (variant === 'floating') {
    return (
      <button
        onClick={handleReturnToEnglish}
        className={`fixed top-4 right-4 z-50 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-bold shadow-lg hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-1.5 ${className}`}
        style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
        aria-label="Switch to English"
      >
        <span className="text-base">🇺🇸</span>
        <span>EN</span>
      </button>
    );
  }

  // Inline variant - compact for headers
  return (
    <button
      onClick={handleReturnToEnglish}
      className={`px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-full text-xs font-semibold transition-all active:scale-95 flex items-center gap-1 ${className}`}
      aria-label="Switch to English"
    >
      <span>🇺🇸</span>
      <span>EN</span>
    </button>
  );
};

export default EnglishQuickReturn;
