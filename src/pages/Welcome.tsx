import { useLanguage, languageOptions } from '@/i18n/LanguageContext';
import { Language } from '@/i18n/translations';
import { Truck } from 'lucide-react';

interface WelcomeScreenProps {
  onComplete: () => void;
}

const WelcomeScreen = ({ onComplete }: WelcomeScreenProps) => {
  const { t, language, setLanguage } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      {/* Logo */}
      <div className="flex flex-col items-center mb-12 animate-fade-in">
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 glow-primary">
          <Truck className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          {t.welcome.title}
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          {t.welcome.subtitle}
        </p>
      </div>

      {/* Tagline */}
      <p className="text-center text-muted-foreground mb-10 max-w-xs">
        {t.welcome.tagline}
      </p>

      {/* Language Selection */}
      <div className="w-full max-w-sm mb-8">
        <p className="text-sm text-muted-foreground text-center mb-4">
          {t.welcome.selectLanguage}
        </p>
        <div className="flex gap-3 justify-center">
          {languageOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setLanguage(option.value as Language)}
              className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 min-w-[90px] ${
                language === option.value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50'
              }`}
            >
              <span className="text-2xl mb-1">{option.flag}</span>
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Get Started Button */}
      <button
        onClick={onComplete}
        className="w-full max-w-sm py-4 px-6 bg-primary text-primary-foreground rounded-xl font-semibold text-lg transition-all duration-200 hover:opacity-90 active:scale-[0.98] glow-primary"
      >
        {t.welcome.getStarted}
      </button>
    </div>
  );
};

export default WelcomeScreen;
