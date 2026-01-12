import React, { useState } from 'react';
import { Building2, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import StarRating from '@/components/stops/StarRating';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Facility } from '@/types/collaborative';
import { TIME_SPENT_OPTIONS } from '@/types/collaborative';
import { cn } from '@/lib/utils';

interface FacilityExitPromptProps {
  facility: Facility;
  timeSpentMs: number;
  wasEasyToFind: boolean | null;
  onComplete: () => void;
  onDismiss: () => void;
}

const FacilityExitPrompt: React.FC<FacilityExitPromptProps> = ({
  facility,
  timeSpentMs,
  wasEasyToFind,
  onComplete,
  onDismiss,
}) => {
  const [submitting, setSubmitting] = useState(false);
  
  // Quick ratings
  const [overallRating, setOverallRating] = useState(0);
  const [friendlinessRating, setFriendlinessRating] = useState(0);
  const [speedRating, setSpeedRating] = useState(0);
  const [structureRating, setStructureRating] = useState(0);
  
  // Structured fields
  const [visitType, setVisitType] = useState<'pickup' | 'delivery' | 'both'>('delivery');
  const [timeSpent, setTimeSpent] = useState<string>(() => {
    // Auto-select time based on actual time spent
    const minutes = timeSpentMs / (60 * 1000);
    if (minutes < 30) return 'less_30';
    if (minutes < 60) return '30_60';
    if (minutes < 120) return '1_2h';
    if (minutes < 240) return '2_4h';
    return 'more_4h';
  });
  const [restroomAvailable, setRestroomAvailable] = useState<'yes' | 'no' | 'unknown'>('unknown');
  const [tips, setTips] = useState('');

  const handleSubmit = async () => {
    if (overallRating === 0) {
      toast({ title: 'Por favor, dê uma avaliação geral', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Por favor, faça login', variant: 'destructive' });
        setSubmitting(false);
        return;
      }

      // Check if user can review (1 review per 7 days)
      const { data: canReview, error: checkError } = await supabase.rpc('can_review_facility', {
        p_user_id: user.id,
        p_facility_id: facility.id,
      });

      if (checkError) throw checkError;
      
      if (!canReview) {
        toast({ 
          title: 'Limite de avaliação atingido', 
          description: 'Você só pode avaliar este local uma vez por semana.',
          variant: 'destructive' 
        });
        setSubmitting(false);
        onComplete();
        return;
      }

      const { error } = await supabase.from('facility_reviews').insert({
        facility_id: facility.id,
        user_id: user.id,
        overall_rating: overallRating,
        treatment_rating: friendlinessRating || null,
        speed_rating: speedRating || null,
        staff_help_rating: structureRating || null, // Using staff_help for structure
        exit_ease_rating: wasEasyToFind ? 5 : wasEasyToFind === false ? 2 : null,
        visit_type: visitType,
        time_spent: timeSpent || null,
        restroom_available: restroomAvailable,
        tips: tips.trim() || null,
      });

      if (error) throw error;
      
      toast({ title: 'Avaliação enviada!', description: 'Obrigado por ajudar outros motoristas.' });
      onComplete();
    } catch (error) {
      console.error('Error submitting review:', error);
      toast({ title: 'Falha ao enviar avaliação', variant: 'destructive' });
    }
    
    setSubmitting(false);
  };

  const handleQuickRating = (rating: number) => {
    setOverallRating(rating);
    // If 4 or 5 stars, auto-fill other ratings as good
    if (rating >= 4) {
      if (!friendlinessRating) setFriendlinessRating(rating);
      if (!speedRating) setSpeedRating(rating);
      if (!structureRating) setStructureRating(rating);
    }
  };

  return (
    <Sheet open={true} onOpenChange={() => onDismiss()}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              Como foi sua experiência?
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={onDismiss}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-5 pb-6">
          {/* Facility info */}
          <div className="p-3 bg-muted/50 rounded-xl">
            <h3 className="font-semibold">{facility.name}</h3>
            {facility.address && (
              <p className="text-sm text-muted-foreground">{facility.address}</p>
            )}
          </div>

          {/* Overall Rating */}
          <div className="space-y-2">
            <Label className="text-base font-medium">Avaliação Geral *</Label>
            <StarRating
              rating={overallRating}
              interactive
              onChange={handleQuickRating}
              size="lg"
            />
          </div>

          {/* Visit Type */}
          <div className="space-y-2">
            <Label>Tipo de Visita</Label>
            <div className="flex gap-2">
              {[
                { value: 'pickup', label: 'Carregamento' },
                { value: 'delivery', label: 'Descarga' },
                { value: 'both', label: 'Ambos' },
              ].map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={visitType === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVisitType(option.value as typeof visitType)}
                  className="flex-1"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Quick Ratings */}
          <div className="space-y-3">
            <Label className="text-muted-foreground">Detalhes (opcional)</Label>
            
            <StarRating
              rating={friendlinessRating}
              interactive
              onChange={setFriendlinessRating}
              label="Pessoas amigáveis?"
            />
            <StarRating
              rating={speedRating}
              interactive
              onChange={setSpeedRating}
              label="Rapidez no serviço"
            />
            <StarRating
              rating={structureRating}
              interactive
              onChange={setStructureRating}
              label="Estrutura (banheiro, etc)"
            />
          </div>

          {/* Time Spent */}
          <div className="space-y-2">
            <Label>Tempo no Local</Label>
            <div className="flex flex-wrap gap-2">
              {TIME_SPENT_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={timeSpent === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeSpent(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Restroom */}
          <div className="space-y-2">
            <Label>Banheiro disponível?</Label>
            <div className="flex gap-2">
              {[
                { value: 'yes', label: 'Sim' },
                { value: 'no', label: 'Não' },
                { value: 'unknown', label: 'Não sei' },
              ].map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={restroomAvailable === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRestroomAvailable(option.value as typeof restroomAvailable)}
                  className="flex-1"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="space-y-2">
            <Label>Dica rápida (opcional)</Label>
            <Textarea
              placeholder="Portão, recepção, documentos, melhor entrada..."
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              rows={2}
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onDismiss} className="flex-1">
              Depois
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={overallRating === 0 || submitting}
              className="flex-1"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Avaliação'
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FacilityExitPrompt;
