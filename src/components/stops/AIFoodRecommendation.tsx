import React, { useState, useEffect } from 'react';
import { Sparkles, ThumbsUp, AlertTriangle, Loader2, Ban, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { FoodRecommendation, StopMenuItem, DriverFoodProfile } from '@/types/stops';

interface AIFoodRecommendationProps {
  placeType: string;
  menuItems: StopMenuItem[];
  userProfile?: DriverFoodProfile | null;
}

const AIFoodRecommendation: React.FC<AIFoodRecommendationProps> = ({
  placeType,
  menuItems,
  userProfile,
}) => {
  const [recommendation, setRecommendation] = useState<FoodRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendation = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('food_recommendation', {
        body: {
          profile: userProfile ? {
            diet_type: userProfile.diet_type,
            allergies: userProfile.allergies,
            restrictions: userProfile.restrictions,
            health_goals: userProfile.health_goals,
            budget_preference: userProfile.budget_preference,
          } : null,
          menuItems: menuItems.map(m => ({
            item_name: m.item_name,
            category: m.category,
            price: m.price,
          })),
          placeType,
        },
      });

      if (fnError) throw fnError;
      
      if (data.error) {
        throw new Error(data.error);
      }

      setRecommendation(data);
    } catch (err) {
      console.error('Failed to get food recommendation:', err);
      setError(err instanceof Error ? err.message : 'Failed to get recommendation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendation();
  }, [placeType]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Getting personalized recommendations...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchRecommendation}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!recommendation) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="w-5 h-5 text-primary" />
          AI Recommendations
          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={fetchRecommendation}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Best Choice */}
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-2 mb-1">
            <ThumbsUp className="w-4 h-4 text-green-600" />
            <span className="font-medium text-green-700 dark:text-green-400">Best Choice</span>
          </div>
          <p className="font-semibold">{recommendation.best_choice.item}</p>
          <p className="text-sm text-muted-foreground">{recommendation.best_choice.reason}</p>
        </div>

        {/* Alternative */}
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 dark:text-blue-400">
              Alternative
            </Badge>
          </div>
          <p className="font-semibold">{recommendation.alternative.item}</p>
          <p className="text-sm text-muted-foreground">{recommendation.alternative.reason}</p>
        </div>

        {/* Emergency Option */}
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Emergency Option</span>
          </div>
          <p className="font-medium">{recommendation.emergency_option.item}</p>
          <p className="text-xs text-muted-foreground">{recommendation.emergency_option.reason}</p>
        </div>

        {/* Avoid List */}
        {recommendation.avoid && recommendation.avoid.length > 0 && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Ban className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-700 dark:text-red-400">Avoid</span>
            </div>
            <div className="space-y-1">
              {recommendation.avoid.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="font-medium text-sm">{item.item}</span>
                  <span className="text-xs text-muted-foreground">- {item.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIFoodRecommendation;
