import React, { useState } from 'react';
import { Heart, HeartOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FavoriteMealButtonProps {
  mealName: string;
  truckStopName: string;
  truckStopId?: string;
  restaurantName: string;
  lat?: number;
  lng?: number;
  size?: 'sm' | 'default';
}

export default function FavoriteMealButton({
  mealName,
  truckStopName,
  truckStopId,
  restaurantName,
  lat,
  lng,
  size = 'sm',
}: FavoriteMealButtonProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in to save favorites');
        return;
      }

      const { error } = await supabase
        .from('favorite_meals')
        .insert({
          user_id: user.id,
          truck_stop_name: truckStopName,
          truck_stop_id: truckStopId,
          restaurant_name: restaurantName,
          meal_name: mealName,
          lat,
          lng,
        });

      if (error) throw error;

      setSaved(true);
      toast.success('Meal saved to favorites!');
    } catch (err) {
      console.error('Error saving favorite:', err);
      toast.error('Could not save favorite');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <Button
        variant="ghost"
        size={size}
        className="text-red-500 hover:text-red-600"
        disabled
      >
        <Heart className="h-4 w-4 fill-current" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleSave}
      disabled={saving}
      className="text-muted-foreground hover:text-red-500"
    >
      {saving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className="h-4 w-4" />
      )}
    </Button>
  );
}
