import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import BottomNav from '@/components/navigation/BottomNav';
import FoodProfileForm from '@/components/stops/FoodProfileForm';
import { supabase } from '@/integrations/supabase/client';
import type { DriverFoodProfile } from '@/types/stops';

const FoodPreferencesScreen: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<DriverFoodProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user and load profile
  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }
      
      setUserId(user.id);
      
      const { data } = await supabase
        .from('driver_food_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setProfile(data as unknown as DriverFoodProfile);
      }
      
      setLoading(false);
    };
    
    loadData();
  }, []);

  const handleSave = async (profileData: {
    diet_type: string;
    allergies: string[];
    restrictions: string[];
    health_goals: string[];
    budget_preference: string;
  }) => {
    if (!userId) {
      toast({ title: 'Please sign in to save preferences', variant: 'destructive' });
      return;
    }
    
    setSaving(true);
    
    if (profile) {
      // Update existing
      const { error } = await supabase
        .from('driver_food_profiles')
        .update({
          ...profileData,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      
      if (error) {
        toast({ title: 'Failed to update preferences', variant: 'destructive' });
        setSaving(false);
        return;
      }
    } else {
      // Create new
      const { error } = await supabase
        .from('driver_food_profiles')
        .insert({
          user_id: userId,
          ...profileData,
        });
      
      if (error) {
        toast({ title: 'Failed to save preferences', variant: 'destructive' });
        setSaving(false);
        return;
      }
    }
    
    setSaving(false);
    toast({ title: 'Preferences saved!' });
    
    // Reload profile
    const { data } = await supabase
      .from('driver_food_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (data) {
      setProfile(data as unknown as DriverFoodProfile);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Food Preferences</h1>
            <p className="text-sm text-muted-foreground">For personalized AI recommendations</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-4">
        {!userId ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Please sign in to save your food preferences</p>
            <Button onClick={() => navigate('/auth')}>Sign In</Button>
          </div>
        ) : (
          <FoodProfileForm
            profile={profile}
            onSave={handleSave}
            isLoading={saving}
          />
        )}
      </div>

      <BottomNav activeTab="profile" onTabChange={(tab) => navigate(`/${tab}`)} />
    </div>
  );
};

export default FoodPreferencesScreen;
