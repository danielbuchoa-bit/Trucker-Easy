import { useLanguage } from '@/i18n/LanguageContext';
import { Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WelcomeScreenProps {
  onComplete: () => void;
}

const WelcomeScreen = ({ onComplete }: WelcomeScreenProps) => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    onComplete();
    navigate('/auth');
  };

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

      {/* Get Started Button - no language selection here */}
      <button
        onClick={handleGetStarted}
        className="w-full max-w-sm py-4 px-6 bg-primary text-primary-foreground rounded-xl font-semibold text-lg transition-all duration-200 hover:opacity-90 active:scale-[0.98] glow-primary"
      >
        {t.welcome.getStarted}
      </button>
    </div>
  );
};

export default WelcomeScreen;
