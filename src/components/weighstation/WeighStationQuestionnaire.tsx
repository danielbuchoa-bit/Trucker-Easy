import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, ChevronLeft, MessageSquare } from 'lucide-react';
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

type ExtendedStatus = 'OPEN' | 'ACTIVELY_MONITORED' | 'CLOSED';
type OutcomeOption = 'BYPASS' | 'ROLLING_ACROSS' | 'INSPECTION';
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
  const [selectedStatus, setSelectedStatus] = useState<ExtendedStatus | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeOption | null>(null);
  const [comment, setComment] = useState('');
  const [timeLeft, setTimeLeft] = useState(45);
  const { toast } = useToast();

  const direction = station.station.name.toLowerCase().includes('west') || 
                    station.station.name.toLowerCase().includes('wb') ? 'West Bound' :
                    station.station.name.toLowerCase().includes('east') || 
                    station.station.name.toLowerCase().includes('eb') ? 'East Bound' :
                    station.station.name.toLowerCase().includes('north') || 
                    station.station.name.toLowerCase().includes('nb') ? 'North Bound' :
                    station.station.name.toLowerCase().includes('south') || 
                    station.station.name.toLowerCase().includes('sb') ? 'South Bound' : null;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

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

  const handleStatusSelect = (status: ExtendedStatus) => {
    setSelectedStatus(status);
    if (status === 'CLOSED') {
      handleSubmit(status, null);
    } else {
      setStep('outcome');
    }
  };

  const handleOutcomeSelect = (outcome: OutcomeOption) => {
    setSelectedOutcome(outcome);
    handleSubmit(selectedStatus!, outcome);
  };

  const handleSubmit = async (status: ExtendedStatus, outcome: OutcomeOption | null) => {
    setStep('submitting');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({ title: 'Please sign in', description: 'You need to be signed in to submit reports', variant: 'destructive' });
        handleSkip();
        return;
      }

      const dbStatus: StationStatus = status === 'CLOSED' ? 'CLOSED' : 'OPEN';
      
      let dbOutcome: ReportOutcome = 'UNKNOWN';
      if (status === 'CLOSED') {
        dbOutcome = 'BYPASS';
      } else if (outcome === 'BYPASS') {
        dbOutcome = 'BYPASS';
      } else if (outcome === 'ROLLING_ACROSS') {
        dbOutcome = 'WEIGHED';
      } else if (outcome === 'INSPECTION') {
        dbOutcome = 'INSPECTED';
      }

      const { error } = await supabase.from('weigh_station_reports').insert({
        station_id: station.station.id,
        user_id: user.id,
        status_reported: dbStatus,
        outcome: dbOutcome,
        lat: userLat,
        lng: userLng,
        route_id_hash: routeHash,
        device_anon_id_hash: null,
        comment: comment.trim() || null,
      } as any);

      if (error) throw error;

      setStep('done');
      toast({ title: 'Thank you!', description: 'Your report helps other drivers.' });

      setTimeout(() => {
        setVisible(false);
        setTimeout(onComplete, 300);
      }, 1500);
    } catch (error) {
      console.error('[WEIGH_Q] Submit error:', error);
      toast({ title: 'Failed to submit', description: 'Please try again later', variant: 'destructive' });
      handleSkip();
    }
  };

  const handleBack = () => {
    setStep('status');
    setSelectedStatus(null);
    setSelectedOutcome(null);
    setComment('');
  };

  const renderStatusStep = () => (
    <div className="space-y-4">
      {direction && (
        <div className="flex border-b border-border">
          <button className="flex-1 py-2 text-sm font-medium text-primary border-b-2 border-primary">
            ← {direction}
          </button>
          <button className="flex-1 py-2 text-sm font-medium text-muted-foreground">
            → {direction === 'West Bound' ? 'East Bound' : 
               direction === 'East Bound' ? 'West Bound' :
               direction === 'North Bound' ? 'South Bound' : 'North Bound'}
          </button>
        </div>
      )}

      <h2 className="text-xl font-bold text-foreground">
        What's the Weigh Station like?
      </h2>

      <div className="flex gap-2">
        <button
          onClick={() => handleStatusSelect('OPEN')}
          className="flex-1 py-4 px-3 bg-green-500 hover:bg-green-600 rounded-xl transition-all active:scale-[0.98]"
        >
          <span className="text-lg font-bold text-white">Open</span>
        </button>

        <button
          onClick={() => handleStatusSelect('ACTIVELY_MONITORED')}
          className="flex-1 py-4 px-3 bg-amber-500 hover:bg-amber-600 rounded-xl transition-all active:scale-[0.98]"
        >
          <span className="text-lg font-bold text-white leading-tight">Actively<br/>Monitored</span>
        </button>

        <button
          onClick={() => handleStatusSelect('CLOSED')}
          className="flex-1 py-4 px-3 bg-red-500 hover:bg-red-600 rounded-xl transition-all active:scale-[0.98]"
        >
          <span className="text-lg font-bold text-white">Closed</span>
        </button>
      </div>

      <div className="text-sm text-muted-foreground pt-2">
        <p className="font-medium text-foreground">{station.station.name}</p>
        {station.station.state && <p>{station.station.state}</p>}
      </div>
    </div>
  );

  const renderOutcomeStep = () => (
    <div className="space-y-4">
      <button
        onClick={handleBack}
        className="flex items-center gap-1 text-muted-foreground text-sm"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${
          selectedStatus === 'OPEN' ? 'bg-green-500' : 
          selectedStatus === 'ACTIVELY_MONITORED' ? 'bg-amber-500' : 'bg-red-500'
        }`} />
        <span className="text-sm font-medium text-muted-foreground">
          {selectedStatus === 'OPEN' ? 'Open' : 
           selectedStatus === 'ACTIVELY_MONITORED' ? 'Actively Monitored' : 'Closed'}
        </span>
      </div>

      <h2 className="text-xl font-bold text-foreground">
        What happened?
      </h2>

      <div className="flex gap-2">
        {/* Bypass - Green */}
        <button
          onClick={() => handleOutcomeSelect('BYPASS')}
          className="flex-1 py-4 px-3 bg-green-500 hover:bg-green-600 rounded-xl transition-all active:scale-[0.98]"
        >
          <span className="text-lg font-bold text-white leading-tight">Bypass</span>
          <span className="block text-xs text-white/80 mt-1">Drove past</span>
        </button>

        {/* Rolling Across - Amber */}
        <button
          onClick={() => handleOutcomeSelect('ROLLING_ACROSS')}
          className="flex-1 py-4 px-3 bg-amber-500 hover:bg-amber-600 rounded-xl transition-all active:scale-[0.98]"
        >
          <span className="text-lg font-bold text-white leading-tight">Rolling<br/>Across</span>
          <span className="block text-xs text-white/80 mt-1">No stop</span>
        </button>

        {/* Inspection - Red */}
        <button
          onClick={() => handleOutcomeSelect('INSPECTION')}
          className="flex-1 py-4 px-3 bg-red-500 hover:bg-red-600 rounded-xl transition-all active:scale-[0.98]"
        >
          <span className="text-lg font-bold text-white leading-tight">Inspection</span>
          <span className="block text-xs text-white/80 mt-1">Pulled in</span>
        </button>
      </div>

      {/* Comment field */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="w-4 h-4" />
          <span>Add a comment (optional)</span>
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="e.g. Long line, DOT checking logs..."
          maxLength={200}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          rows={2}
        />
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
      <div 
        className={`
          fixed inset-0 bg-black/70 z-[80]
          transition-opacity duration-300
          ${visible ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={handleSkip}
      />

      <div 
        className={`
          fixed inset-x-0 bottom-0 z-[81]
          bg-card rounded-t-3xl shadow-2xl
          transition-transform duration-300 ease-out
          ${visible ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-muted" />
        </div>

        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        {(step === 'status' || step === 'outcome') && (
          <div className="h-1 bg-muted mx-4 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-linear"
              style={{ width: `${(timeLeft / 45) * 100}%` }}
            />
          </div>
        )}

        <div className="px-4 py-4 pb-10">
          {step === 'status' && renderStatusStep()}
          {step === 'outcome' && renderOutcomeStep()}
          {step === 'submitting' && renderSubmitting()}
          {step === 'done' && renderDone()}

          {(step === 'status' || step === 'outcome') && (
            <button
              onClick={handleSkip}
              className="w-full mt-4 py-2 text-muted-foreground text-sm"
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
