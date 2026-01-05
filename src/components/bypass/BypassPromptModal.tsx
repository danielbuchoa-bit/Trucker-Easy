import { useEffect, useState, useCallback } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { X, Scale, DoorOpen, DoorClosed, CheckCircle, XCircle } from 'lucide-react';
import { BypassResult, WeighStation } from '@/types/bypass';

interface BypassPromptModalProps {
  station: WeighStation;
  onSubmit: (result: BypassResult) => void;
  onClose: () => void;
}

const BypassPromptModal = ({ station, onSubmit, onClose }: BypassPromptModalProps) => {
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState(15);
  const [step, setStep] = useState<'status' | 'bypass'>('status');

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

  const handleStatusSelect = (isOpen: boolean) => {
    if (!isOpen) {
      // Station was closed - submit directly
      onSubmit('station_closed');
    } else {
      // Station open - ask about bypass
      setStep('bypass');
      setTimeLeft(12); // Reset timer for next step
    }
  };

  const handleBypassSelect = (receivedBypass: boolean) => {
    onSubmit(receivedBypass ? 'bypass_received' : 'no_bypass');
  };

  return (
    <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center p-4 pointer-events-none">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-2xl border border-border overflow-hidden pointer-events-auto animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-primary/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Scale className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-sm">{t.bypass?.weighStation || 'Weigh Station'}</h2>
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
            style={{ width: `${(timeLeft / (step === 'status' ? 15 : 12)) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-5">
          {step === 'status' ? (
            <>
              <p className="text-center text-foreground font-medium mb-5 text-sm">
                {t.bypass?.wasStationOpen || 'Was the weigh station open or closed?'}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => handleStatusSelect(true)}
                  className="flex-1 py-4 px-4 bg-green-500/10 hover:bg-green-500/20 border-2 border-green-500 rounded-xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <DoorOpen className="w-6 h-6 text-green-500" />
                  <span className="text-sm font-semibold text-green-500">
                    {t.bypass?.open || 'Open'}
                  </span>
                </button>

                <button
                  onClick={() => handleStatusSelect(false)}
                  className="flex-1 py-4 px-4 bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500 rounded-xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <DoorClosed className="w-6 h-6 text-red-500" />
                  <span className="text-sm font-semibold text-red-500">
                    {t.bypass?.closed || 'Closed'}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-center text-foreground font-medium mb-5 text-sm">
                {t.bypass?.didYouReceiveBypass || 'Did you receive bypass?'}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => handleBypassSelect(true)}
                  className="flex-1 py-4 px-4 bg-green-500/10 hover:bg-green-500/20 border-2 border-green-500 rounded-xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  <span className="text-sm font-semibold text-green-500">
                    {t.bypass?.gotBypass || 'Yes, Bypass'}
                  </span>
                </button>

                <button
                  onClick={() => handleBypassSelect(false)}
                  className="flex-1 py-4 px-4 bg-orange-500/10 hover:bg-orange-500/20 border-2 border-orange-500 rounded-xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <XCircle className="w-6 h-6 text-orange-500" />
                  <span className="text-sm font-semibold text-orange-500">
                    {t.bypass?.pulledIn || 'No, Pulled In'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Skip */}
        <div className="px-5 pb-4">
          <button
            onClick={handleClose}
            className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t.common?.skip || 'Skip'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BypassPromptModal;
