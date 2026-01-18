import React, { useState } from 'react';
import { X, Star, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PoiFeedbackRecord {
  id: string;
  poi_id: string;
  poi_name: string;
  poi_type: string;
  friendliness_rating: number;
  cleanliness_rating: number;
  structure_rating: number | null;
  recommendation_rating: number;
  would_return: boolean | null;
  created_at: string;
}

interface EditPoiRatingModalProps {
  rating: PoiFeedbackRecord;
  onSave: (updated: Partial<PoiFeedbackRecord>) => Promise<void>;
  onCancel: () => void;
}

const StarRating: React.FC<{
  label: string;
  value: number;
  onChange: (val: number) => void;
}> = ({ label, value, onChange }) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                'w-7 h-7 transition-colors',
                star <= value
                  ? 'fill-yellow-500 text-yellow-500'
                  : 'text-muted-foreground/30 hover:text-yellow-500/50'
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

const EditPoiRatingModal: React.FC<EditPoiRatingModalProps> = ({
  rating,
  onSave,
  onCancel,
}) => {
  const [friendliness, setFriendliness] = useState(rating.friendliness_rating);
  const [cleanliness, setCleanliness] = useState(rating.cleanliness_rating);
  const [structure, setStructure] = useState(rating.structure_rating || 0);
  const [recommendation, setRecommendation] = useState(rating.recommendation_rating);
  const [wouldReturn, setWouldReturn] = useState(rating.would_return);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      friendliness_rating: friendliness,
      cleanliness_rating: cleanliness,
      structure_rating: structure || null,
      recommendation_rating: recommendation,
      would_return: wouldReturn,
    });
    setSaving(false);
  };

  const getPoiTypeLabel = (type: string) => {
    switch (type) {
      case 'fuel': return 'Posto';
      case 'truck_stop': return 'Truck Stop';
      case 'rest_area': return 'Área de Descanso';
      default: return type;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-in fade-in">
      <div className="w-full max-w-lg bg-background rounded-t-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Editar Avaliação</h2>
            <p className="text-sm text-muted-foreground">{rating.poi_name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          <StarRating
            label="Atendimento / Simpatia"
            value={friendliness}
            onChange={setFriendliness}
          />

          <StarRating
            label="Limpeza"
            value={cleanliness}
            onChange={setCleanliness}
          />

          <StarRating
            label="Estrutura / Instalações"
            value={structure}
            onChange={setStructure}
          />

          <StarRating
            label="Recomendação Geral"
            value={recommendation}
            onChange={setRecommendation}
          />

          {/* Would Return */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Você voltaria a este local?
            </label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={wouldReturn === true ? 'default' : 'outline'}
                className={cn(
                  'flex-1 gap-2',
                  wouldReturn === true && 'bg-green-600 hover:bg-green-700'
                )}
                onClick={() => setWouldReturn(true)}
              >
                <ThumbsUp className="w-4 h-4" />
                Sim
              </Button>
              <Button
                type="button"
                variant={wouldReturn === false ? 'default' : 'outline'}
                className={cn(
                  'flex-1 gap-2',
                  wouldReturn === false && 'bg-red-600 hover:bg-red-700'
                )}
                onClick={() => setWouldReturn(false)}
              >
                <ThumbsDown className="w-4 h-4" />
                Não
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t border-border p-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={saving || friendliness === 0 || cleanliness === 0 || recommendation === 0}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditPoiRatingModal;
