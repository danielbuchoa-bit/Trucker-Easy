import { useState, useEffect, useCallback } from 'react';
import { Scale, X, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
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

// Extended status to match Trucker Path style
type ExtendedStatus = 'OPEN' | 'ACTIVELY_MONITORED' | 'CLOSED';

// Outcome options for second step
type TrafficLevel = 'NOBODY' | 'SOMEBODY' | 'WAITING';

type Step = 'status' | 'traffic' | 'submitting' | 'done';

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
  const [selectedTraffic, setSelectedTraffic] = useState<TrafficLevel | null>(null);
  const [timeLeft, setTimeLeft] = useState(45);
  const { toast } = useToast();

  // Determine direction from station name or route
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

  const handleStatusSelect = (status: ExtendedStatus) => {
    setSelectedStatus(status);
    // If closed, we can skip traffic step since nobody is there
    if (status === 'CLOSED') {
      handleSubmit(status, null);
    } else {
      setStep('traffic');
    }
  };

  const handleTrafficSelect = (traffic: TrafficLevel) => {
    setSelectedTraffic(traffic);
    handleSubmit(selectedStatus!, traffic);
  };

  const handleSubmit = async (status: ExtendedStatus, traffic: TrafficLevel | null) => {
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

      // Map extended status to database status
      const dbStatus: StationStatus = status === 'CLOSED' ? 'CLOSED' : 'OPEN';
      
      // Map traffic level to outcome
      let outcome: ReportOutcome = 'UNKNOWN';
      if (status === 'CLOSED') {
        outcome = 'BYPASS';
      } else if (traffic === 'NOBODY') {
        outcome = 'BYPASS';
      } else if (traffic === 'SOMEBODY' || traffic === 'WAITING') {
        outcome = 'WEIGHED';
      }

      const { error } = await supabase.from('weigh_station_reports').insert({
        station_id: station.station.id,
        user_id: user.id,
        status_reported: dbStatus,
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

  const handleBack = () => {
    setStep('status');
    setSelectedStatus(null);
  };

  const renderStatusStep = () => (
    <div className="space-y-4">
      {/* Direction tabs */}
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
        What's the weigh Station like?
      </h2>

      <div className="flex gap-2">
        {/* Open - Green */}
        <button
          onClick={() => handleStatusSelect('OPEN')}
          className="flex-1 py-4 px-3 bg-green-500 hover:bg-green-600 rounded-xl transition-all active:scale-[0.98]"
        >
          <span className="text-lg font-bold text-white">Open</span>
        </button>

        {/* Actively Monitored - Yellow/Amber */}
        <button
          onClick={() => handleStatusSelect('ACTIVELY_MONITORED')}
          className="flex-1 py-4 px-3 bg-amber-500 hover:bg-amber-600 rounded-xl transition-all active:scale-[0.98]"
        >
          <span className="text-lg font-bold text-white leading-tight">Actively<br/>Monitored</span>
        </button>

        {/* Closed - Red */}
        <button
          onClick={() => handleStatusSelect('CLOSED')}
          className="flex-1 py-4 px-3 bg-red-500 hover:bg-red-600 rounded-xl transition-all active:scale-[0.98]"
        >
          <span className="text-lg font-bold text-white">Closed</span>
        </button>
      </div>

      {/* Station info */}
      <div className="text-sm text-muted-foreground pt-2">
        <p className="font-medium text-foreground">{station.station.name}</p>
        {station.station.state && <p>{station.station.state}</p>}
      </div>
    </div>
  );

  const renderTrafficStep = () => (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-1 text-muted-foreground text-sm"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      {/* Status indicator */}
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
        What's happening there?
      </h2>

      <div className="flex gap-2">
        {/* Nobody */}
        <button
          onClick={() => handleTrafficSelect('NOBODY')}
          className="flex-1 py-4 px-3 bg-card border-2 border-primary/50 hover:border-primary hover:bg-card/80 rounded-xl transition-all active:scale-[0.98]"
        >
          <span className="text-lg font-bold text-primary">Nobody</span>
        </button>

        {/* Somebody */}
        <button
          onClick={() => handleTrafficSelect('SOMEBODY')}
          className="flex-1 py-4 px-3 bg-card border-2 border-primary/50 hover:border-primary hover:bg-card/80 rounded-xl transition-all active:scale-[0.98]"
        >
          <span className="text-lg font-bold text-primary">Somebody</span>
        </button>

        {/* Somebody is waiting */}
        <button
          onClick={() => handleTrafficSelect('WAITING')}
          className="flex-1 py-4 px-3 bg-card border-2 border-primary/50 hover:border-primary hover:bg-card/80 rounded-xl transition-all active:scale-[0.98]"
        >
          <span className="text-lg font-bold text-primary leading-tight">Somebody<br/>is waiting</span>
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
        onClick={handleSkip}
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

        {/* Close button - top right */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Timer bar */}
        {(step === 'status' || step === 'traffic') && (
          <div className="h-1 bg-muted mx-4 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-linear"
              style={{ width: `${(timeLeft / 45) * 100}%` }}
            />
          </div>
        )}

        {/* Content */}
        <div className="px-4 py-4 pb-10">
          {step === 'status' && renderStatusStep()}
          {step === 'traffic' && renderTrafficStep()}
          {step === 'submitting' && renderSubmitting()}
          {step === 'done' && renderDone()}

          {/* Skip button */}
          {(step === 'status' || step === 'traffic') && (
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
