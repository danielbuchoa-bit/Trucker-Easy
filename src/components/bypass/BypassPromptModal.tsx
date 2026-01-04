import { useEffect, useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { CheckCircle, XCircle, HelpCircle, X, Scale } from 'lucide-react';
import { BypassResult, WeighStation } from '@/types/bypass';

interface BypassPromptModalProps {
  station: WeighStation;
  onSubmit: (result: BypassResult) => void;
  onClose: () => void;
}

const BypassPromptModal = ({ station, onSubmit, onClose }: BypassPromptModalProps) => {
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState(12);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  const handleSelect = (result: BypassResult) => {
    onSubmit(result);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-2xl border border-border overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-primary/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Scale className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">{t.bypass.weighStation}</h2>
              <p className="text-sm text-muted-foreground">{station.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Timer bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / 12) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-center text-foreground font-medium mb-6">
            {t.bypass.didYouBypass}
          </p>

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => handleSelect('bypass')}
              className="w-full py-4 px-6 bg-green-500/10 hover:bg-green-500/20 border-2 border-green-500 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
            >
              <CheckCircle className="w-6 h-6 text-green-500" />
              <span className="text-lg font-semibold text-green-500">{t.bypass.gotBypass}</span>
            </button>

            <button
              onClick={() => handleSelect('pull_in')}
              className="w-full py-4 px-6 bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
            >
              <XCircle className="w-6 h-6 text-red-500" />
              <span className="text-lg font-semibold text-red-500">{t.bypass.pulledIn}</span>
            </button>

            <button
              onClick={() => handleSelect('unknown')}
              className="w-full py-3 px-6 bg-muted hover:bg-muted/80 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
            >
              <HelpCircle className="w-5 h-5 text-muted-foreground" />
              <span className="text-muted-foreground">{t.bypass.dontKnow}</span>
            </button>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="px-6 pb-4">
          <p className="text-xs text-muted-foreground text-center">
            {t.bypass.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BypassPromptModal;
