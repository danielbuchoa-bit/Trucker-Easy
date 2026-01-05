import { useEffect, useState, useCallback } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { X, Scale } from 'lucide-react';
import { BypassResult, WeighStation } from '@/types/bypass';

interface BypassPromptModalProps {
  station: WeighStation;
  onSubmit: (result: BypassResult) => void;
  onClose: () => void;
}

const BypassPromptModal = ({ station, onSubmit, onClose }: BypassPromptModalProps) => {
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState(15);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [handleClose]);

  const handleSelect = (result: BypassResult) => {
    onSubmit(result);
  };

  return (
    <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center p-4 pointer-events-none">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden pointer-events-auto animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-primary/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Scale className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-sm">
                {t.bypass?.whatIsStationLike || "What's the Weigh Station like?"}
              </h2>
              <p className="text-xs text-muted-foreground">{station.name}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Timer bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / 15) * 100}%` }}
          />
        </div>

        {/* Content - 3 horizontal buttons like the reference image */}
        <div className="p-4 space-y-3">
          {/* Three buttons in a row */}
          <div className="flex gap-2">
            {/* Open - Green */}
            <button
              onClick={() => handleSelect('open_bypass')}
              className="flex-1 py-4 bg-green-500 hover:bg-green-600 rounded-xl flex items-center justify-center transition-all active:scale-[0.98]"
            >
              <span className="text-sm font-bold text-white">
                {t.bypass?.open || 'Open'}
              </span>
            </button>

            {/* Actively Monitored - Yellow/Amber */}
            <button
              onClick={() => handleSelect('actively_monitored')}
              className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 rounded-xl flex items-center justify-center transition-all active:scale-[0.98]"
            >
              <span className="text-sm font-bold text-white text-center leading-tight">
                {t.bypass?.activelyMonitored || 'Actively\nMonitored'}
              </span>
            </button>

            {/* Closed - Red/Coral */}
            <button
              onClick={() => handleSelect('station_closed')}
              className="flex-1 py-4 bg-red-400 hover:bg-red-500 rounded-xl flex items-center justify-center transition-all active:scale-[0.98]"
            >
              <span className="text-sm font-bold text-white">
                {t.bypass?.closed || 'Closed'}
              </span>
            </button>
          </div>

          {/* Station info below buttons */}
          <div className="text-xs text-muted-foreground text-center">
            {station.state && <span>{station.state} • </span>}
            <span>{t.bypass?.tapToReport || 'Tap to report status'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BypassPromptModal;
