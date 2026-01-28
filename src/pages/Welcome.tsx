import { useLanguage } from '@/i18n/LanguageContext';
import { useNavigate } from 'react-router-dom';
import truckerEaseLogo from '@/assets/trucker-ease-logo.png';

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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      {/* Cyber grid background effect */}
      <div className="absolute inset-0 cyber-grid opacity-30" />
      
      {/* Glow effect behind logo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary rounded-full blur-[120px] opacity-20" />

      {/* Logo */}
      <div className="flex flex-col items-center mb-8 animate-fade-in relative z-10">
        <img 
          src={truckerEaseLogo} 
          alt="TruckerEase" 
          className="w-64 h-64 object-contain mb-4 drop-shadow-[0_0_30px_hsl(var(--primary)/0.5)]"
        />
        <p className="text-lg text-primary mt-2 font-medium tracking-wide">
          {t.welcome.subtitle}
        </p>
      </div>

      {/* Tagline */}
      <p className="text-center text-muted-foreground mb-10 max-w-xs relative z-10">
        {t.welcome.tagline}
      </p>

      {/* Get Started Button with cyber styling */}
      <button
        onClick={handleGetStarted}
        className="w-full max-w-sm py-4 px-6 bg-primary text-primary-foreground rounded-xl font-semibold text-lg transition-all duration-300 glow-primary hover:glow-neon-strong active:scale-[0.98] relative z-10 neon-border"
      >
        {t.welcome.getStarted}
      </button>
      
      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
    </div>
  );
};

export default WelcomeScreen;
