import React from 'react';
import { Pill, X, Check, AlarmClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Medication } from '@/hooks/useMedications';

interface MedicationReminderBannerProps {
  medication: Medication;
  onTaken: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
}

/**
 * A discrete banner for medication reminders shown during navigation/driving mode.
 * Non-blocking and positioned at the top of the screen.
 */
const MedicationReminderBanner: React.FC<MedicationReminderBannerProps> = ({
  medication,
  onTaken,
  onSnooze,
  onDismiss,
}) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-2 safe-area-inset-top animate-in slide-in-from-top duration-300">
      <div className="mx-auto max-w-lg bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-lg">
        <div className="flex items-center gap-3 p-3">
          <div className="p-2 rounded-full bg-primary/10 shrink-0">
            <Pill className="w-5 h-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {medication.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {medication.dosage_text}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-green-600 hover:bg-green-500/10"
              onClick={onTaken}
            >
              <Check className="w-4 h-4" />
            </Button>
            {medication.snooze_enabled && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-amber-600 hover:bg-amber-500/10"
                onClick={onSnooze}
              >
                <AlarmClock className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground"
              onClick={onDismiss}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicationReminderBanner;
