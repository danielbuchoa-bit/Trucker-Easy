import React, { useState } from 'react';
import { Loader2, Fuel, Bath, Users, ParkingCircle, Coffee, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import StarRating from '@/components/stops/StarRating';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface TruckStopReviewFormProps {
  poiId: string;
  poiName: string;
  poiType: 'fuel' | 'truck_stop' | 'rest_area';
  onComplete: () => void;
  onCancel: () => void;
}

const TruckStopReviewForm: React.FC<TruckStopReviewFormProps> = ({
  poiId,
  poiName,
  poiType,
  onComplete,
  onCancel,
}) => {
  const [submitting, setSubmitting] = useState(false);
  
  // Ratings - focused on gas station/truck stop experience
  const [overallRating, setOverallRating] = useState(0);
  const [structureRating, setStructureRating] = useState(0); // Parking, facilities
  const [cleanlinessRating, setCleanlinessRating] = useState(0); // Bathrooms, common areas
  const [friendlinessRating, setFriendlinessRating] = useState(0); // Staff service
  
  // Optional details
  const [parkingRating, setParkingRating] = useState(0);
  const [fuelPriceRating, setFuelPriceRating] = useState(0);
  const [foodRating, setFoodRating] = useState(0);
  
  // Would return
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);
  
  // Tips
  const [tips, setTips] = useState('');

  const getPoiTypeLabel = () => {
    switch (poiType) {
      case 'fuel': return 'Posto';
      case 'truck_stop': return 'Truck Stop';
      case 'rest_area': return 'Área de Descanso';
      default: return 'Local';
    }
  };

  const handleQuickRating = (rating: number) => {
    setOverallRating(rating);
    // Auto-fill other ratings if giving high rating
    if (rating >= 4) {
      if (!structureRating) setStructureRating(rating);
      if (!cleanlinessRating) setCleanlinessRating(rating);
      if (!friendlinessRating) setFriendlinessRating(rating);
    }
  };

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

      // Check if user can submit feedback (1 per day per POI)
      const { data: canSubmit, error: checkError } = await supabase.rpc('can_submit_poi_feedback', {
        p_poi_id: poiId,
        p_user_id: user.id,
      });

      if (checkError) {
        console.error('Error checking feedback limit:', checkError);
      } else if (!canSubmit) {
        toast({ 
          title: 'Limite de avaliação atingido', 
          description: 'Você já avaliou este local recentemente.',
          variant: 'destructive' 
        });
        setSubmitting(false);
        onComplete();
        return;
      }

      const { error } = await supabase.from('poi_feedback').insert({
        poi_id: poiId,
        poi_name: poiName,
        poi_type: poiType,
        user_id: user.id,
        friendliness_rating: friendlinessRating || overallRating,
        cleanliness_rating: cleanlinessRating || overallRating,
        structure_rating: structureRating || null,
        recommendation_rating: overallRating,
        would_return: wouldReturn,
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

  return (
    <div className="space-y-5">
      {/* POI Info */}
      <div className="p-3 bg-muted/50 rounded-xl">
        <div className="flex items-center gap-2">
          <Fuel className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">{poiName}</h3>
            <p className="text-xs text-muted-foreground">{getPoiTypeLabel()}</p>
          </div>
        </div>
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

      {/* Main Ratings - Structure, Cleanliness, Service */}
      <div className="space-y-3">
        <Label className="text-muted-foreground">Avaliações Detalhadas</Label>
        
        <div className="flex items-center gap-2">
          <ParkingCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <StarRating
            rating={structureRating}
            interactive
            onChange={setStructureRating}
            label="Estrutura (estacionamento, comodidades)"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Bath className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <StarRating
            rating={cleanlinessRating}
            interactive
            onChange={setCleanlinessRating}
            label="Limpeza (banheiros, área comum)"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <StarRating
            rating={friendlinessRating}
            interactive
            onChange={setFriendlinessRating}
            label="Atendimento (funcionários)"
          />
        </div>
      </div>

      {/* Optional Ratings */}
      <div className="space-y-3">
        <Label className="text-muted-foreground text-xs">Opcionais</Label>
        
        <div className="flex items-center gap-2">
          <Fuel className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <StarRating
            rating={fuelPriceRating}
            interactive
            onChange={setFuelPriceRating}
            label="Preço combustível"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Coffee className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <StarRating
            rating={foodRating}
            interactive
            onChange={setFoodRating}
            label="Alimentação"
          />
        </div>
      </div>

      {/* Would Return */}
      <div className="space-y-2">
        <Label>Voltaria aqui?</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={wouldReturn === true ? 'default' : 'outline'}
            size="sm"
            className="flex-1 gap-1"
            onClick={() => setWouldReturn(true)}
          >
            <ThumbsUp className="w-4 h-4" />
            Sim
          </Button>
          <Button
            type="button"
            variant={wouldReturn === false ? 'destructive' : 'outline'}
            size="sm"
            className="flex-1 gap-1"
            onClick={() => setWouldReturn(false)}
          >
            <ThumbsDown className="w-4 h-4" />
            Não
          </Button>
        </div>
      </div>

      {/* Tips */}
      <div className="space-y-2">
        <Label>Dica rápida (opcional)</Label>
        <Textarea
          placeholder="Melhor bomba, horário, estacionamento preferencial..."
          value={tips}
          onChange={(e) => setTips(e.target.value)}
          rows={2}
        />
      </div>

      {/* Submit Buttons */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancelar
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
  );
};

export default TruckStopReviewForm;
