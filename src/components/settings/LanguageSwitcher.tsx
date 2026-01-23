import React from 'react';
import { Check, Globe } from 'lucide-react';
import { useLanguage, languageOptions } from '@/i18n/LanguageContext';
import { Language } from '@/i18n/translations';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { toast } from 'sonner';

interface LanguageSwitcherProps {
  trigger?: React.ReactNode;
  showCurrentLanguage?: boolean;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  trigger, 
  showCurrentLanguage = true 
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = React.useState(false);

  const handleLanguageSelect = (lang: Language) => {
    setLanguage(lang);
    setOpen(false);
    
    // Show confirmation toast in the new language
    const confirmationMessages: Record<Language, string> = {
      en: 'Language changed to English',
      es: 'Idioma cambiado a Español',
      pt: 'Idioma alterado para Português',
    };
    toast.success(confirmationMessages[lang]);
  };

  const currentLang = languageOptions.find(l => l.value === language);

  const defaultTrigger = (
    <button className="w-full p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
          <Globe className="w-5 h-5" />
        </div>
        <span className="font-medium">{t.settings.language}</span>
      </div>
      {showCurrentLanguage && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-xl">{currentLang?.flag}</span>
          <span>{currentLang?.label}</span>
        </div>
      )}
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || defaultTrigger}
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t.settings.language}
          </SheetTitle>
        </SheetHeader>
        
        <div className="space-y-2 pb-6">
          {languageOptions.map((option) => {
            const isSelected = language === option.value;
            
            return (
              <button
                key={option.value}
                onClick={() => handleLanguageSelect(option.value)}
                className={`w-full p-4 rounded-xl flex items-center justify-between transition-colors ${
                  isSelected 
                    ? 'bg-primary/10 border-2 border-primary' 
                    : 'bg-card border border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{option.flag}</span>
                  <div className="text-left">
                    <p className="font-semibold text-foreground">{option.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {option.value === 'en' && 'English (US)'}
                      {option.value === 'es' && 'Español (US)'}
                      {option.value === 'pt' && 'Português (BR)'}
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default LanguageSwitcher;
