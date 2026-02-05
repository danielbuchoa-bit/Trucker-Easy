import { useLanguage } from '@/i18n/LanguageContext';
import { useNavigate } from 'react-router-dom';
import truckerEasyLogo from '@/assets/trucker-easy-logo-new.png';

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
      {/* Hexagon tech pattern background */}
      <div className="absolute inset-0 hexagon-pattern opacity-40" />
      
      {/* Circuit line decorations */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      
      {/* Steel glow effect behind logo */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary rounded-full blur-[100px] opacity-15" />

      {/* Logo */}
      <div className="flex flex-col items-center mb-6 animate-fade-in relative z-10">
        <img 
          src={truckerEasyLogo} 
          alt="TruckerEasy Technologies" 
          className="w-72 h-72 object-contain drop-shadow-[0_0_40px_hsl(200_55%_50%/0.4)]"
        />
      </div>

      {/* Tagline */}
      <p className="text-center text-muted-foreground mb-10 max-w-sm relative z-10 text-lg tracking-wide">
        {t.welcome.tagline}
      </p>

      {/* Get Started Button with metallic styling */}
      <button
        onClick={handleGetStarted}
        className="w-full max-w-sm py-4 px-6 metallic-gradient text-white rounded-xl font-semibold text-lg transition-all duration-300 glow-steel hover:glow-steel-strong active:scale-[0.98] relative z-10 tech-border tracking-wider uppercase"
      >
        {t.welcome.getStarted}
      </button>

      {/* Version badge */}
      <p className="absolute bottom-8 text-xs text-muted-foreground/60 tracking-widest uppercase">
        Technologies
      </p>
    </div>
  );
};

export default WelcomeScreen;
