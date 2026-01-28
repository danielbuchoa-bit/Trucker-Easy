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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-black relative overflow-hidden">
      {/* Cyber grid background effect */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--primary)/0.1)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--primary)/0.1)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>
      
      {/* Glow effect behind logo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[hsl(200,100%,50%)] rounded-full blur-[120px] opacity-20" />

      {/* Logo */}
      <div className="flex flex-col items-center mb-8 animate-fade-in relative z-10">
        <img 
          src={truckerEaseLogo} 
          alt="TruckerEase" 
          className="w-64 h-64 object-contain mb-4 drop-shadow-[0_0_30px_rgba(59,130,246,0.5)]"
        />
        <p className="text-lg text-[hsl(200,80%,70%)] mt-2 font-medium tracking-wide">
          {t.welcome.subtitle}
        </p>
      </div>

      {/* Tagline */}
      <p className="text-center text-gray-400 mb-10 max-w-xs relative z-10">
        {t.welcome.tagline}
      </p>

      {/* Get Started Button with cyber styling */}
      <button
        onClick={handleGetStarted}
        className="w-full max-w-sm py-4 px-6 bg-gradient-to-r from-[hsl(200,100%,45%)] to-[hsl(210,100%,55%)] text-white rounded-xl font-semibold text-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] active:scale-[0.98] relative z-10 border border-[hsl(200,100%,60%)/30]"
      >
        {t.welcome.getStarted}
      </button>
      
      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[hsl(200,100%,50%)] to-transparent opacity-50" />
    </div>
  );
};

export default WelcomeScreen;
