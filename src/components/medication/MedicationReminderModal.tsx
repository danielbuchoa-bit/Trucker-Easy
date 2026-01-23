import React, { useState } from 'react';
import { Pill, Clock, Check, AlarmClock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Medication } from '@/hooks/useMedications';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MedicationReminderModalProps {
  open: boolean;
  medication: Medication | null;
  scheduledTime: Date | null;
  onTaken: () => void;
  onSnooze: (minutes: number) => void;
  onSkip: () => void;
  onClose: () => void;
}

const MedicationReminderModal: React.FC<MedicationReminderModalProps> = ({
  open,
  medication,
  scheduledTime,
  onTaken,
  onSnooze,
  onSkip,
  onClose,
}) => {
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);

  if (!medication || !scheduledTime) return null;

  const handleSnooze = (minutes: number) => {
    onSnooze(minutes);
    setShowSnoozeOptions(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Pill className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">Hora do Medicamento</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block text-lg font-semibold text-foreground">
              {medication.name}
            </span>
            <span className="block text-muted-foreground">
              {medication.dosage_text}
            </span>
            {medication.notes && (
              <span className="block text-sm text-muted-foreground italic">
                "{medication.notes}"
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>
            Agendado para {format(scheduledTime, "HH:mm", { locale: ptBR })}
          </span>
        </div>

        {!showSnoozeOptions ? (
          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={onTaken}
              className="w-full h-12 text-base bg-green-600 hover:bg-green-700"
            >
              <Check className="w-5 h-5 mr-2" />
              Tomei
            </Button>
            
            {medication.snooze_enabled && medication.snooze_options.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowSnoozeOptions(true)}
                className="w-full h-12 text-base"
              >
                <AlarmClock className="w-5 h-5 mr-2" />
                Adiar
              </Button>
            )}
            
            <Button
              variant="ghost"
              onClick={onSkip}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4 mr-2" />
              Pular
            </Button>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-center text-muted-foreground">
              Adiar por quanto tempo?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {medication.snooze_options.map((mins) => (
                <Button
                  key={mins}
                  variant="outline"
                  onClick={() => handleSnooze(mins)}
                  className="h-12"
                >
                  {mins} minutos
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              onClick={() => setShowSnoozeOptions(false)}
              className="w-full text-muted-foreground"
            >
              Voltar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MedicationReminderModal;
