import React, { useState } from 'react';
import { Check, Globe, Search } from 'lucide-react';
import { useLanguage, LanguageOption } from '@/i18n/LanguageContext';
import { Language } from '@/i18n/translations';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface LanguageSwitcherProps {
  trigger?: React.ReactNode;
  showCurrentLanguage?: boolean;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  trigger, 
  showCurrentLanguage = true 
}) => {
  const { language, setLanguage, t, availableLanguages } = useLanguage();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleLanguageSelect = (option: LanguageOption) => {
    setLanguage(option.value);
    setOpen(false);
    setSearchQuery('');
    
    // Show confirmation toast in the selected language
    const confirmationMessages: Record<Language, string> = {
      en: 'Language changed to English',
      es: 'Idioma cambiado a Español',
      pt: 'Idioma alterado para Português',
    };
    toast.success(confirmationMessages[option.value] || `Language changed to ${option.label}`);
  };

  const currentLang = availableLanguages.find(l => l.value === language);

  // Filter languages by search query
  const filteredLanguages = availableLanguages.filter(option => 
    option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    option.nativeLabel.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const defaultTrigger = (
    <button className="w-full p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
          <Globe className="w-5 h-5" />
        </div>
        <span className="font-medium">{t.settings.language}</span>
      </div>
      {showCurrentLanguage && currentLang && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-xl">{currentLang.flag}</span>
          <span>{currentLang.label}</span>
        </div>
      )}
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setSearchQuery('');
    }}>
      <SheetTrigger asChild>
        {trigger || defaultTrigger}
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t.settings.language}
          </SheetTitle>
        </SheetHeader>
        
        {/* Search field for large language lists */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t.map?.searchPlaces || 'Search...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="space-y-2 pb-6 overflow-y-auto flex-1">
          {filteredLanguages.map((option) => {
            const isSelected = language === option.value;
            
            return (
              <button
                key={`${option.value}-${option.region}`}
                onClick={() => handleLanguageSelect(option)}
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
                      {option.nativeLabel} {option.region && `(${option.region})`}
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
          
          {filteredLanguages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No results found</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default LanguageSwitcher;
