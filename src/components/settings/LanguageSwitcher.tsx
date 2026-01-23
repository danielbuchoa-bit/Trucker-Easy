import React, { useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { useLanguage, LanguageOption } from '@/i18n/LanguageContext';
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
  const { 
    language, 
    setLanguage, 
    t, 
    availableLanguages,
    currentLanguageOption,
  } = useLanguage();
  const [open, setOpen] = useState(false);

  const handleLanguageSelect = (option: LanguageOption) => {
    console.log('[LanguageSwitcher] Selected:', option.value, option.label);
    setLanguage(option.value);
    setOpen(false);
    toast.success(`Language: ${option.label}`, {
      description: option.nativeLabel,
    });
  };

  const defaultTrigger = (
    <button className="w-full p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
          <Globe className="w-5 h-5" />
        </div>
        <span className="font-medium">{t.settings.language}</span>
      </div>
      {showCurrentLanguage && currentLanguageOption && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-xl">{currentLanguageOption.flag}</span>
          <span>{currentLanguageOption.label}</span>
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
        
        <div className="space-y-3 pb-6">
          {availableLanguages.map((option) => {
            const isSelected = language === option.value;
            
            return (
              <button
                key={option.value}
                onClick={() => handleLanguageSelect(option)}
                className={`w-full p-4 rounded-xl flex items-center justify-between transition-colors ${
                  isSelected 
                    ? 'bg-primary/10 border-2 border-primary' 
                    : 'bg-card border border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{option.flag}</span>
                  <div className="text-left">
                    <p className="font-medium text-foreground">{option.label}</p>
                    <p className="text-sm text-muted-foreground">{option.nativeLabel}</p>
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
