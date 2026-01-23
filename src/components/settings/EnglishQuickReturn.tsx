import React, { useEffect, useState } from 'react';
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
 * Includes subtle fade/scale animation on appear/disappear.
 */
const EnglishQuickReturn: React.FC<EnglishQuickReturnProps> = ({ 
  variant = 'inline',
  className = '' 
}) => {
  const { language, setLanguage } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  const isNotEnglish = language !== 'en';

  useEffect(() => {
    if (isNotEnglish) {
      setShouldRender(true);
      // Small delay to trigger animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      // Wait for exit animation before unmounting
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isNotEnglish]);

  if (!shouldRender) {
    return null;
  }

  const handleReturnToEnglish = () => {
    setLanguage('en');
    toast.success('Language set to English');
  };

  const animationClasses = isVisible 
    ? 'opacity-100 scale-100' 
    : 'opacity-0 scale-90';

  if (variant === 'floating') {
    return (
      <button
        onClick={handleReturnToEnglish}
        className={`fixed top-4 right-4 z-50 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-bold shadow-lg hover:bg-primary/90 transition-all duration-200 ease-out active:scale-95 flex items-center gap-1.5 ${animationClasses} ${className}`}
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
      className={`px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-full text-xs font-semibold transition-all duration-200 ease-out active:scale-95 flex items-center gap-1 ${animationClasses} ${className}`}
      aria-label="Switch to English"
    >
      <span>🇺🇸</span>
      <span>EN</span>
    </button>
  );
};

export default EnglishQuickReturn;
