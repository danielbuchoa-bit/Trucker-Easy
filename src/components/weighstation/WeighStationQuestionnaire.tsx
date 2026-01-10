import { useState, useEffect, useCallback } from 'react';
import { Scale, X, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StationOnRoute, StationStatus, ReportOutcome } from '@/hooks/useWeighStationAlerts';
import { useToast } from '@/hooks/use-toast';

interface WeighStationQuestionnaireProps {
  station: StationOnRoute;
  userLat: number;
  userLng: number;
  routeHash: string;
  onComplete: () => void;
  onSkip: () => void;
}

type Step = 'status' | 'outcome' | 'submitting' | 'done';

const WeighStationQuestionnaire = ({
  station,
  userLat,
  userLng,
  routeHash,
  onComplete,
  onSkip,
}: WeighStationQuestionnaireProps) => {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>('status');
  const [selectedStatus, setSelectedStatus] = useState<StationStatus | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const { toast } = useToast();

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Auto-skip timer
  useEffect(() => {
    if (step === 'submitting' || step === 'done') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSkip();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step]);

  const handleSkip = useCallback(() => {
    setVisible(false);
    setTimeout(onSkip, 300);
  }, [onSkip]);

  const handleStatusSelect = (status: StationStatus) => {
    setSelectedStatus(status);
    setStep('outcome');
  };

  const handleOutcomeSelect = async (outcome: ReportOutcome) => {
    if (!selectedStatus) return;

    setStep('submitting');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: 'Please sign in',
          description: 'You need to be signed in to submit reports',
          variant: 'destructive',
        });
        handleSkip();
        return;
      }

      const { error } = await supabase.from('weigh_station_reports').insert({
        station_id: station.station.id,
        user_id: user.id,
        status_reported: selectedStatus,
        outcome,
        lat: userLat,
        lng: userLng,
        route_id_hash: routeHash,
        device_anon_id_hash: null,
      });

      if (error) throw error;

      setStep('done');
      toast({
        title: 'Thank you!',
        description: 'Your report helps other drivers.',
      });

      setTimeout(() => {
        setVisible(false);
        setTimeout(onComplete, 300);
      }, 1500);
    } catch (error) {
      console.error('[WEIGH_Q] Submit error:', error);
      toast({
        title: 'Failed to submit',
        description: 'Please try again later',
        variant: 'destructive',
      });
      handleSkip();
    }
  };

  const renderStatusStep = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-black text-center text-foreground">
        WAS THE STATION:
      </h2>

      <div className="space-y-3">
        <button
          onClick={() => handleStatusSelect('OPEN')}
          className="w-full py-5 bg-green-500 hover:bg-green-600 rounded-2xl transition-all active:scale-[0.98]"
        >
          <span className="text-2xl font-black text-white">OPEN</span>
        </button>

        <button
          onClick={() => handleStatusSelect('CLOSED')}
          className="w-full py-5 bg-red-500 hover:bg-red-600 rounded-2xl transition-all active:scale-[0.98]"
        >
          <span className="text-2xl font-black text-white">CLOSED</span>
        </button>

        <button
          onClick={() => handleStatusSelect('UNKNOWN')}
          className="w-full py-5 bg-gray-500 hover:bg-gray-600 rounded-2xl transition-all active:scale-[0.98]"
        >
          <span className="text-xl font-bold text-white">DON'T KNOW / DIDN'T SEE</span>
        </button>
      </div>
    </div>
  );

  const renderOutcomeStep = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-black text-center text-foreground">
        WHAT HAPPENED TO YOU?
      </h2>

      <div className="space-y-3">
        <button
          onClick={() => handleOutcomeSelect('BYPASS')}
          className="w-full py-5 bg-green-500 hover:bg-green-600 rounded-2xl transition-all active:scale-[0.98]"
        >
          <span className="text-2xl font-black text-white">GOT BYPASS</span>
        </button>

        <button
          onClick={() => handleOutcomeSelect('WEIGHED')}
          className="w-full py-5 bg-amber-500 hover:bg-amber-600 rounded-2xl transition-all active:scale-[0.98]"
        >
          <span className="text-2xl font-black text-white">HAD TO WEIGH</span>
        </button>

        <button
          onClick={() => handleOutcomeSelect('INSPECTED')}
          className="w-full py-5 bg-red-500 hover:bg-red-600 rounded-2xl transition-all active:scale-[0.98]"
        >
          <span className="text-2xl font-black text-white">WAS INSPECTED</span>
        </button>

        <button
          onClick={() => handleOutcomeSelect('UNKNOWN')}
          className="w-full py-5 bg-gray-500 hover:bg-gray-600 rounded-2xl transition-all active:scale-[0.98]"
        >
          <span className="text-xl font-bold text-white">PREFER NOT TO SAY</span>
        </button>
      </div>
    </div>
  );

  const renderSubmitting = () => (
    <div className="py-12 flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 text-lg font-semibold text-foreground">Submitting...</p>
    </div>
  );

  const renderDone = () => (
    <div className="py-12 flex flex-col items-center justify-center">
      <CheckCircle className="w-16 h-16 text-green-500" />
      <p className="mt-4 text-xl font-bold text-foreground">Thank you!</p>
      <p className="text-muted-foreground">Your report helps other drivers</p>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`
          fixed inset-0 bg-black/70 z-[80]
          transition-opacity duration-300
          ${visible ? 'opacity-100' : 'opacity-0'}
        `}
      />

      {/* Sheet */}
      <div 
        className={`
          fixed inset-x-0 bottom-0 z-[81]
          bg-card rounded-t-3xl shadow-2xl
          transition-transform duration-300 ease-out
          ${visible ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-muted" />
        </div>

        {/* Header */}
        <div className="px-4 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center">
              <Scale className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">You passed</p>
              <h3 className="text-lg font-bold text-foreground">
                {station.station.name}
              </h3>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timer bar */}
        {(step === 'status' || step === 'outcome') && (
          <div className="h-1 bg-muted mx-4 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-linear"
              style={{ width: `${(timeLeft / 60) * 100}%` }}
            />
          </div>
        )}

        {/* Content */}
        <div className="px-4 py-6 pb-10">
          {step === 'status' && renderStatusStep()}
          {step === 'outcome' && renderOutcomeStep()}
          {step === 'submitting' && renderSubmitting()}
          {step === 'done' && renderDone()}

          {/* Skip button */}
          {(step === 'status' || step === 'outcome') && (
            <button
              onClick={handleSkip}
              className="w-full mt-4 py-3 text-muted-foreground font-medium"
            >
              Skip ({timeLeft}s)
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default WeighStationQuestionnaire;
