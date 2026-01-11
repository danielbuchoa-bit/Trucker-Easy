import React, { useEffect, useState } from 'react';
import { Heart, Trash2, MapPin, UtensilsCrossed, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface FavoriteMeal {
  id: string;
  truck_stop_name: string;
  truck_stop_id: string | null;
  restaurant_name: string;
  meal_name: string;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export default function FavoriteMealsList() {
  const [meals, setMeals] = useState<FavoriteMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('favorite_meals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMeals(data || []);
    } catch (err) {
      console.error('Error fetching favorites:', err);
      toast.error('Could not load favorites');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('favorite_meals')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMeals((prev) => prev.filter((m) => m.id !== id));
      toast.success('Favorite removed');
    } catch (err) {
      console.error('Error deleting favorite:', err);
      toast.error('Could not remove favorite');
    } finally {
      setDeletingId(null);
    }
  };

  // Group by truck stop
  const groupedMeals = meals.reduce((acc, meal) => {
    const key = meal.truck_stop_name;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(meal);
    return acc;
  }, {} as Record<string, FavoriteMeal[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (meals.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Heart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="font-semibold text-lg mb-2">No Favorite Meals Yet</h3>
        <p className="text-muted-foreground text-sm">
          When you find a great meal at a truck stop, save it here for easy reference next time!
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedMeals).map(([truckStop, stopMeals]) => (
        <div key={truckStop}>
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">{truckStop}</h3>
            <Badge variant="secondary" className="text-xs">
              {stopMeals.length} {stopMeals.length === 1 ? 'meal' : 'meals'}
            </Badge>
          </div>
          
          <div className="space-y-2">
            {stopMeals.map((meal) => (
              <Card key={meal.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <UtensilsCrossed className="h-4 w-4 text-orange-500 shrink-0" />
                      <span className="font-medium truncate">{meal.meal_name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {meal.restaurant_name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(meal.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                    {meal.notes && (
                      <p className="text-sm text-muted-foreground mt-2">{meal.notes}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(meal.id)}
                    disabled={deletingId === meal.id}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    {deletingId === meal.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
