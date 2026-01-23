import React, { useState, useMemo } from 'react';
import { Check, Globe, Search, Star } from 'lucide-react';
import { useLanguage, LanguageOption } from '@/i18n/LanguageContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface LanguageSwitcherProps {
  trigger?: React.ReactNode;
  showCurrentLanguage?: boolean;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  trigger, 
  showCurrentLanguage = true 
}) => {
  const { languageCode, setLanguage, t, favoriteLanguages, otherLanguages, availableLanguages } = useLanguage();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleLanguageSelect = (option: LanguageOption) => {
    setLanguage(option.code);
    setOpen(false);
    setSearchQuery('');
    toast.success('Language changed to ' + option.label);
  };

  const currentLang = availableLanguages.find(l => l.code === languageCode);

  // Filter languages by search query (matches English name, native name, or code)
  const filteredFavorites = useMemo(() => {
    if (!searchQuery.trim()) return favoriteLanguages;
    const query = searchQuery.toLowerCase();
    return favoriteLanguages.filter(option => 
      option.label.toLowerCase().includes(query) ||
      option.nativeLabel.toLowerCase().includes(query) ||
      option.code.toLowerCase().includes(query)
    );
  }, [favoriteLanguages, searchQuery]);

  const filteredOthers = useMemo(() => {
    if (!searchQuery.trim()) return otherLanguages;
    const query = searchQuery.toLowerCase();
    return otherLanguages.filter(option => 
      option.label.toLowerCase().includes(query) ||
      option.nativeLabel.toLowerCase().includes(query) ||
      option.code.toLowerCase().includes(query)
    );
  }, [otherLanguages, searchQuery]);

  const totalResults = filteredFavorites.length + filteredOthers.length;

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

  const LanguageItem = ({ option }: { option: LanguageOption }) => {
    const isSelected = languageCode === option.code;
    
    return (
      <button
        onClick={() => handleLanguageSelect(option)}
        className={`w-full p-3 rounded-xl flex items-center justify-between transition-colors ${
          isSelected 
            ? 'bg-primary/10 border-2 border-primary' 
            : 'bg-card border border-border hover:border-primary/50'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{option.flag}</span>
          <div className="text-left">
            <p className="font-medium text-foreground text-sm">{option.label}</p>
            <p className="text-xs text-muted-foreground">{option.nativeLabel}</p>
          </div>
        </div>
        {isSelected && (
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-3 h-3 text-primary-foreground" />
          </div>
        )}
      </button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setSearchQuery('');
    }}>
      <SheetTrigger asChild>
        {trigger || defaultTrigger}
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl h-[85vh] flex flex-col">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t.settings.language}
            <span className="text-xs text-muted-foreground font-normal">
              ({availableLanguages.length} languages)
            </span>
          </SheetTitle>
        </SheetHeader>
        
        {/* Search field */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search languages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            autoComplete="off"
          />
        </div>
        
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pb-6">
            {/* Favorites section */}
            {filteredFavorites.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <Star className="w-3 h-3 fill-current" />
                  <span>Popular</span>
                </div>
                <div className="space-y-2">
                  {filteredFavorites.map((option) => (
                    <LanguageItem key={option.code} option={option} />
                  ))}
                </div>
              </div>
            )}
            
            {/* All languages section */}
            {filteredOthers.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  All Languages
                </div>
                <div className="space-y-2">
                  {filteredOthers.map((option) => (
                    <LanguageItem key={option.code} option={option} />
                  ))}
                </div>
              </div>
            )}
            
            {/* No results */}
            {totalResults === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No languages found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default LanguageSwitcher;
