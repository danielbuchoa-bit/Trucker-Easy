import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useEmotionalCheckIn } from '@/contexts/EmotionalCheckInContext';
import { Sun, Moon, Star, Zap, Brain, Activity, X, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const StarRating: React.FC<{
  value: number;
  onChange: (value: number) => void;
  labels: { low: string; high: string };
}> = ({ value, onChange, labels }) => {
  return (
    <div className="space-y-2">
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`p-2 rounded-full transition-all duration-200 ${
              star <= value 
                ? 'bg-primary text-primary-foreground scale-110' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Star className={`w-8 h-8 ${star <= value ? 'fill-current' : ''}`} />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground px-2">
        <span>{labels.low}</span>
        <span>{labels.high}</span>
      </div>
    </div>
  );
};

const EmotionalCheckInModal: React.FC = () => {
  const { 
    isCheckInModalOpen, 
    checkInType, 
    isSubmitting, 
    closeCheckInModal, 
    submitCheckIn,
    dismissCheckIn 
  } = useEmotionalCheckIn();
  
  const [energyLevel, setEnergyLevel] = useState(0);
  const [stressLevel, setStressLevel] = useState(0);
  const [bodyCondition, setBodyCondition] = useState(0);
  const [dayQuality, setDayQuality] = useState(0);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const isMorning = checkInType === 'morning';
  const totalSteps = isMorning ? 3 : 4;

  const questions = [
    {
      icon: Zap,
      title: 'Como está seu nível de energia?',
      labels: { low: 'Exausto', high: 'Cheio de energia' },
      value: energyLevel,
      onChange: setEnergyLevel,
      color: 'text-yellow-500'
    },
    {
      icon: Brain,
      title: 'Como está seu nível de estresse?',
      labels: { low: 'Muito alto', high: 'Muito baixo' },
      value: stressLevel,
      onChange: setStressLevel,
      color: 'text-purple-500'
    },
    {
      icon: Activity,
      title: 'Como está seu corpo hoje?',
      labels: { low: 'Dor forte', high: 'Sem dores' },
      value: bodyCondition,
      onChange: setBodyCondition,
      color: 'text-green-500'
    },
    {
      icon: Star,
      title: 'Qualidade geral do dia',
      labels: { low: 'Péssimo', high: 'Excelente' },
      value: dayQuality,
      onChange: setDayQuality,
      color: 'text-amber-500'
    }
  ];

  const currentQuestion = questions[currentStep];
  const canProceed = currentQuestion?.value > 0;
  const isLastStep = currentStep === totalSteps - 1;

  const handleNext = async () => {
    if (isLastStep) {
      const success = await submitCheckIn({
        energyLevel,
        stressLevel,
        bodyCondition,
        dayQuality: isMorning ? undefined : dayQuality,
        notes: notes.trim() || undefined
      });
      
      if (success) {
        toast.success(isMorning ? 'Bom dia registrado!' : 'Boa noite registrada!');
        resetForm();
      } else {
        toast.error('Erro ao salvar. Tente novamente.');
      }
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleDismiss = () => {
    dismissCheckIn(checkInType);
    resetForm();
  };

  const resetForm = () => {
    setEnergyLevel(0);
    setStressLevel(0);
    setBodyCondition(0);
    setDayQuality(0);
    setNotes('');
    setShowNotes(false);
    setCurrentStep(0);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleDismiss();
    }
  };

  const Icon = currentQuestion?.icon || Sun;

  return (
    <Dialog open={isCheckInModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 bg-card border-border overflow-hidden">
        {/* Header */}
        <div className={`p-4 ${isMorning ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20' : 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isMorning ? (
                <Sun className="w-6 h-6 text-amber-500" />
              ) : (
                <Moon className="w-6 h-6 text-indigo-400" />
              )}
              <h2 className="text-lg font-semibold text-foreground">
                {isMorning ? 'Bom dia!' : 'Como foi seu dia?'}
              </h2>
            </div>
            <Button variant="ghost" size="icon" onClick={handleDismiss} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isMorning ? 'Como você está começando o dia?' : 'Registre como você se sentiu hoje'}
          </p>
          
          {/* Progress dots */}
          <div className="flex gap-1 mt-3">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div 
                key={i} 
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= currentStep ? 'bg-primary' : 'bg-muted'
                }`} 
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="text-center space-y-4">
            <div className={`inline-flex p-3 rounded-full bg-muted ${currentQuestion?.color}`}>
              <Icon className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-foreground">
              {currentQuestion?.title}
            </h3>
          </div>

          <StarRating
            value={currentQuestion?.value || 0}
            onChange={currentQuestion?.onChange || (() => {})}
            labels={currentQuestion?.labels || { low: '', high: '' }}
          />

          {/* Notes section - appears after answering last question */}
          {isLastStep && currentQuestion?.value > 0 && (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
              {!showNotes ? (
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => setShowNotes(true)}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Adicionar observação
                </Button>
              ) : (
                <Textarea
                  placeholder="Algum sintoma ou observação? (opcional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-none"
                  rows={2}
                  autoFocus
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-3">
          {currentStep > 0 && (
            <Button 
              variant="outline" 
              onClick={handleBack}
              className="flex-1"
            >
              Voltar
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isLastStep ? (
              'Salvar'
            ) : (
              'Próximo'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmotionalCheckInModal;
