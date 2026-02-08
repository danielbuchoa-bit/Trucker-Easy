import React, { useState } from 'react';
import { Fuel, X, Loader2, ThumbsUp, ThumbsDown, Bath, Users, ParkingCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import StarRating from '@/components/stops/StarRating';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TruckStopExitPromptProps {
  poiId: string;
  poiName: string;
  poiType: string; // Accept any string, will be mapped to valid DB values
  timeSpentMs: number;
  onComplete: () => void;
  onDismiss: () => void;
}

// Map frontend poi types to valid database values
const mapPoiTypeToDbValue = (type: string | undefined): 'fuel' | 'truck_stop' | 'rest_area' => {
  if (!type) return 'truck_stop';
  const typeLower = type.toLowerCase();
  
  if (typeLower.includes('fuel') || typeLower.includes('gas') || typeLower.includes('diesel')) {
    return 'fuel';
  }
  if (typeLower.includes('rest') || typeLower === 'rest_area' || typeLower === 'restarea') {
    return 'rest_area';
  }
  return 'truck_stop';
};

const TruckStopExitPrompt: React.FC<TruckStopExitPromptProps> = ({
  poiId,
  poiName,
  poiType,
  timeSpentMs,
  onComplete,
  onDismiss,
}) => {
  const [submitting, setSubmitting] = useState(false);
  
  // Ratings - focused on gas station/truck stop experience
  const [overallRating, setOverallRating] = useState(0);
  const [structureRating, setStructureRating] = useState(0);
  const [cleanlinessRating, setCleanlinessRating] = useState(0);
  const [friendlinessRating, setFriendlinessRating] = useState(0);
  
  // Would return
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);

  const getPoiTypeLabel = () => {
    const dbType = mapPoiTypeToDbValue(poiType);
    switch (dbType) {
      case 'fuel': return 'Posto';
      case 'truck_stop': return 'Truck Stop';
      case 'rest_area': return 'Área de Descanso';
      default: return 'Local';
    }
  };

  const formatTimeSpent = () => {
    const minutes = Math.round(timeSpentMs / (60 * 1000));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}min` : `${hours}h`;
  };

  const handleQuickRating = (rating: number) => {
    setOverallRating(rating);
    if (rating >= 4) {
      if (!structureRating) setStructureRating(rating);
      if (!cleanlinessRating) setCleanlinessRating(rating);
      if (!friendlinessRating) setFriendlinessRating(rating);
    }
  };

  const handleSubmit = async () => {
    if (overallRating === 0) {
      toast({ title: 'Please give an overall rating', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Please sign in', variant: 'destructive' });
        setSubmitting(false);
        return;
      }

      // Check if user can submit feedback
      const { data: canSubmit, error: checkError } = await supabase.rpc('can_submit_poi_feedback', {
        p_poi_id: poiId,
        p_user_id: user.id,
      });

      if (checkError) {
        console.error('Error checking feedback limit:', checkError);
      } else if (!canSubmit) {
        toast({ 
          title: 'Rating limit reached', 
          description: 'You already rated this location recently.',
          variant: 'destructive' 
        });
        setSubmitting(false);
        onComplete();
        return;
      }

      const dbPoiType = mapPoiTypeToDbValue(poiType);
      
      const { error } = await supabase.from('poi_feedback').insert({
        poi_id: poiId,
        poi_name: poiName,
        poi_type: dbPoiType,
        user_id: user.id,
        friendliness_rating: friendlinessRating || overallRating,
        cleanliness_rating: cleanlinessRating || overallRating,
        structure_rating: structureRating || null,
        recommendation_rating: overallRating,
        would_return: wouldReturn,
      });

      if (error) throw error;
      
      toast({ title: 'Review submitted!', description: 'Thanks for helping other drivers.' });
      onComplete();
    } catch (error) {
      console.error('Error submitting review:', error);
      toast({ title: 'Failed to submit review', variant: 'destructive' });
    }
    
    setSubmitting(false);
  };

  return (
    <Sheet open={true} onOpenChange={() => onDismiss()}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <Fuel className="h-5 w-5 text-primary" />
              How was your experience?
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={onDismiss}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-5 pb-6">
          {/* POI info */}
          <div className="p-3 bg-muted/50 rounded-xl">
            <h3 className="font-semibold">{poiName}</h3>
            <p className="text-sm text-muted-foreground">
              {getPoiTypeLabel()} • Tempo: {formatTimeSpent()}
            </p>
          </div>

          {/* Overall Rating */}
          <div className="space-y-2">
            <label className="text-base font-medium">Overall Rating *</label>
            <StarRating
              rating={overallRating}
              interactive
              onChange={handleQuickRating}
              size="lg"
            />
          </div>

          {/* Quick Ratings */}
          <div className="space-y-3">
            <label className="text-muted-foreground">Details (optional)</label>
            
            <div className="flex items-center gap-2">
              <ParkingCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <StarRating
                  rating={structureRating}
                  interactive
                  onChange={setStructureRating}
                  label="Facilities (parking)"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Bath className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <StarRating
                  rating={cleanlinessRating}
                  interactive
                  onChange={setCleanlinessRating}
                  label="Cleanliness (restrooms)"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <StarRating
                  rating={friendlinessRating}
                  interactive
                  onChange={setFriendlinessRating}
                  label="Service"
                />
              </div>
            </div>
          </div>

          {/* Would Return */}
          <div className="space-y-2">
            <label>Would you return?</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={wouldReturn === true ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-1"
                onClick={() => setWouldReturn(true)}
              >
                <ThumbsUp className="w-4 h-4" />
                Yes
              </Button>
              <Button
                type="button"
                variant={wouldReturn === false ? 'destructive' : 'outline'}
                size="sm"
                className="flex-1 gap-1"
                onClick={() => setWouldReturn(false)}
              >
                <ThumbsDown className="w-4 h-4" />
                No
              </Button>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onDismiss} className="flex-1">
              Later
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={overallRating === 0 || submitting}
              className="flex-1"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Review'
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TruckStopExitPrompt;
