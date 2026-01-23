import { useState, useEffect } from 'react';
import { useLanguage, SUPPORTED_LANGUAGES } from '@/i18n/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

const LANGUAGE_SUGGESTION_KEY = 'truckereasy-language-suggested';

/**
 * Detects browser language and suggests switching if it matches a supported language
 * Only shows once per device, after user's first access
 */
const LanguageSuggestionModal = () => {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [suggestedLang, setSuggestedLang] = useState<typeof SUPPORTED_LANGUAGES[0] | null>(null);

  useEffect(() => {
    // Check if we already suggested
    const alreadySuggested = localStorage.getItem(LANGUAGE_SUGGESTION_KEY);
    if (alreadySuggested) return;

    // Detect browser language
    const browserLang = navigator.language || (navigator as any).userLanguage || 'en';
    const langPrefix = browserLang.slice(0, 2).toLowerCase();

    console.log('[i18n] Detected browser language:', browserLang, '-> prefix:', langPrefix);

    // Find matching supported language (not English, since that's default)
    const matchedLang = SUPPORTED_LANGUAGES.find(
      (l) => l.value === langPrefix && l.value !== 'en'
    );

    if (matchedLang && language === 'en') {
      console.log('[i18n] Suggesting language switch to:', matchedLang.value);
      setSuggestedLang(matchedLang);
      setOpen(true);
    } else {
      // Mark as suggested even if no match (don't ask again)
      localStorage.setItem(LANGUAGE_SUGGESTION_KEY, 'true');
    }
  }, [language]);

  const handleAccept = () => {
    if (suggestedLang) {
      setLanguage(suggestedLang.value);
    }
    localStorage.setItem(LANGUAGE_SUGGESTION_KEY, 'true');
    setOpen(false);
  };

  const handleDecline = () => {
    localStorage.setItem(LANGUAGE_SUGGESTION_KEY, 'true');
    setOpen(false);
  };

  if (!suggestedLang) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Language Detected
          </DialogTitle>
          <DialogDescription className="pt-2">
            We detected your device is set to{' '}
            <span className="font-semibold text-foreground">
              {suggestedLang.flag} {suggestedLang.nativeLabel}
            </span>
            . Would you like to switch the app to this language?
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center py-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted">
            <span className="text-3xl">{suggestedLang.flag}</span>
            <div>
              <p className="font-medium">{suggestedLang.nativeLabel}</p>
              <p className="text-sm text-muted-foreground">{suggestedLang.label}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleDecline} className="w-full sm:w-auto">
            Keep English
          </Button>
          <Button onClick={handleAccept} className="w-full sm:w-auto">
            Switch to {suggestedLang.nativeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LanguageSuggestionModal;
