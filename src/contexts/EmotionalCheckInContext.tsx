import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CheckInData {
  energyLevel: number;
  stressLevel: number;
  bodyCondition: number;
  dayQuality?: number;
  notes?: string;
}

interface CheckInRecord {
  id: string;
  checkin_type: 'morning' | 'evening';
  energy_level: number;
  stress_level: number;
  body_condition: number;
  day_quality: number | null;
  notes: string | null;
  created_at: string;
}

interface WellnessInsight {
  type: 'energy' | 'stress' | 'body' | 'overall';
  message: string;
  severity: 'info' | 'warning' | 'alert';
}

interface EmotionalCheckInContextValue {
  shouldShowMorningCheckIn: boolean;
  shouldShowEveningCheckIn: boolean;
  isCheckInModalOpen: boolean;
  checkInType: 'morning' | 'evening';
  isSubmitting: boolean;
  todayMorningCheckIn: CheckInRecord | null;
  todayEveningCheckIn: CheckInRecord | null;
  weeklyHistory: CheckInRecord[];
  insights: WellnessInsight[];
  openMorningCheckIn: () => void;
  openEveningCheckIn: () => void;
  closeCheckInModal: () => void;
  submitCheckIn: (data: CheckInData) => Promise<boolean>;
  dismissCheckIn: (type: 'morning' | 'evening') => void;
  refreshHistory: () => Promise<void>;
  getAverages: (days: number) => { energy: number; stress: number; body: number; overall: number };
}

const EmotionalCheckInContext = createContext<EmotionalCheckInContextValue | undefined>(undefined);

const MORNING_DISMISSED_KEY = 'emotional_checkin_morning_dismissed';
const EVENING_DISMISSED_KEY = 'emotional_checkin_evening_dismissed';

export const EmotionalCheckInProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [checkInType, setCheckInType] = useState<'morning' | 'evening'>('morning');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [todayMorningCheckIn, setTodayMorningCheckIn] = useState<CheckInRecord | null>(null);
  const [todayEveningCheckIn, setTodayEveningCheckIn] = useState<CheckInRecord | null>(null);
  const [weeklyHistory, setWeeklyHistory] = useState<CheckInRecord[]>([]);
  const [insights, setInsights] = useState<WellnessInsight[]>([]);
  const [morningDismissed, setMorningDismissed] = useState(false);
  const [eveningDismissed, setEveningDismissed] = useState(false);
  
  // Use centralized user ID from AuthContext
  const userId = user?.id ?? null;

  // Check if dismissed today
  useEffect(() => {
    const today = new Date().toDateString();
    const morningDismissedDate = localStorage.getItem(MORNING_DISMISSED_KEY);
    const eveningDismissedDate = localStorage.getItem(EVENING_DISMISSED_KEY);
    
    setMorningDismissed(morningDismissedDate === today);
    setEveningDismissed(eveningDismissedDate === today);
  }, []);

  // Fetch today's check-ins when user is authenticated and auth loading completes
  useEffect(() => {
    // Wait until auth is fully loaded before fetching
    if (isAuthLoading) return;
    
    if (userId) {
      fetchTodayCheckIns(userId);
      fetchWeeklyHistory(userId);
    }
  }, [userId, isAuthLoading]);

  const fetchTodayCheckIns = async (uid: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data } = await supabase
      .from('emotional_checkins')
      .select('*')
      .eq('user_id', uid)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });
    
    if (data) {
      const morning = data.find(c => c.checkin_type === 'morning');
      const evening = data.find(c => c.checkin_type === 'evening');
      setTodayMorningCheckIn(morning as CheckInRecord || null);
      setTodayEveningCheckIn(evening as CheckInRecord || null);
    }
  };

  const fetchWeeklyHistory = async (uid: string) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const { data } = await supabase
      .from('emotional_checkins')
      .select('*')
      .eq('user_id', uid)
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: false });
    
    if (data) {
      setWeeklyHistory(data as CheckInRecord[]);
      generateInsights(data as CheckInRecord[]);
    }
  };

  const generateInsights = (history: CheckInRecord[]) => {
    if (history.length < 2) return;
    
    const newInsights: WellnessInsight[] = [];
    const avgEnergy = history.reduce((sum, c) => sum + c.energy_level, 0) / history.length;
    const avgStress = history.reduce((sum, c) => sum + c.stress_level, 0) / history.length;
    const avgBody = history.reduce((sum, c) => sum + c.body_condition, 0) / history.length;
    
    // Low energy pattern
    if (avgEnergy < 2.5) {
      newInsights.push({
        type: 'energy',
        message: 'Energia baixa nos últimos dias. Considere pausas mais frequentes.',
        severity: 'warning'
      });
    }
    
    // High stress pattern
    if (avgStress < 2.5) {
      newInsights.push({
        type: 'stress',
        message: 'Nível de estresse elevado. Exercícios de respiração podem ajudar.',
        severity: 'alert'
      });
    }
    
    // Body pain pattern
    if (avgBody < 2.5) {
      newInsights.push({
        type: 'body',
        message: 'Desconforto corporal frequente. Alongamentos são recomendados.',
        severity: 'warning'
      });
    }
    
    // Combined low scores
    const recentLow = history.slice(0, 3).filter(c => 
      c.energy_level <= 2 && c.stress_level <= 2
    );
    if (recentLow.length >= 2) {
      newInsights.push({
        type: 'overall',
        message: 'Dias difíceis recentemente. Priorize seu descanso.',
        severity: 'alert'
      });
    }
    
    setInsights(newInsights);
  };

  const refreshHistory = useCallback(async () => {
    if (userId) {
      await fetchTodayCheckIns(userId);
      await fetchWeeklyHistory(userId);
    }
  }, [userId]);

  const getAverages = useCallback((days: number) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const filtered = weeklyHistory.filter(c => new Date(c.created_at) >= cutoff);
    if (filtered.length === 0) return { energy: 0, stress: 0, body: 0, overall: 0 };
    
    const avgEnergy = filtered.reduce((sum, c) => sum + c.energy_level, 0) / filtered.length;
    const avgStress = filtered.reduce((sum, c) => sum + c.stress_level, 0) / filtered.length;
    const avgBody = filtered.reduce((sum, c) => sum + c.body_condition, 0) / filtered.length;
    const withQuality = filtered.filter(c => c.day_quality !== null);
    const avgOverall = withQuality.length > 0 
      ? withQuality.reduce((sum, c) => sum + (c.day_quality || 0), 0) / withQuality.length 
      : 0;
    
    return { energy: avgEnergy, stress: avgStress, body: avgBody, overall: avgOverall };
  }, [weeklyHistory]);

  // Check if should show morning check-in (first app open of the day) - only after auth is loaded
  const shouldShowMorningCheckIn = !isAuthLoading && !todayMorningCheckIn && !morningDismissed && userId !== null;
  
  // Check if should show evening check-in (after 6 PM and no evening check-in yet) - only after auth is loaded
  const currentHour = new Date().getHours();
  const shouldShowEveningCheckIn = !isAuthLoading && !todayEveningCheckIn && !eveningDismissed && currentHour >= 18 && userId !== null;

  const openMorningCheckIn = () => {
    setCheckInType('morning');
    setIsCheckInModalOpen(true);
  };

  const openEveningCheckIn = () => {
    setCheckInType('evening');
    setIsCheckInModalOpen(true);
  };

  const closeCheckInModal = () => {
    setIsCheckInModalOpen(false);
  };

  const dismissCheckIn = (type: 'morning' | 'evening') => {
    const today = new Date().toDateString();
    if (type === 'morning') {
      localStorage.setItem(MORNING_DISMISSED_KEY, today);
      setMorningDismissed(true);
    } else {
      localStorage.setItem(EVENING_DISMISSED_KEY, today);
      setEveningDismissed(true);
    }
    closeCheckInModal();
  };

  const submitCheckIn = async (data: CheckInData): Promise<boolean> => {
    if (!userId) return false;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('emotional_checkins')
        .insert({
          user_id: userId,
          checkin_type: checkInType,
          energy_level: data.energyLevel,
          stress_level: data.stressLevel,
          body_condition: data.bodyCondition,
          day_quality: checkInType === 'evening' ? data.dayQuality : null,
          notes: data.notes || null
        });
      
      if (error) {
        console.error('Error submitting check-in:', error);
        return false;
      }
      
      await refreshHistory();
      closeCheckInModal();
      return true;
    } catch (error) {
      console.error('Error submitting check-in:', error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <EmotionalCheckInContext.Provider value={{
      shouldShowMorningCheckIn,
      shouldShowEveningCheckIn,
      isCheckInModalOpen,
      checkInType,
      isSubmitting,
      todayMorningCheckIn,
      todayEveningCheckIn,
      weeklyHistory,
      insights,
      openMorningCheckIn,
      openEveningCheckIn,
      closeCheckInModal,
      submitCheckIn,
      dismissCheckIn,
      refreshHistory,
      getAverages
    }}>
      {children}
    </EmotionalCheckInContext.Provider>
  );
};

export const useEmotionalCheckIn = (): EmotionalCheckInContextValue => {
  const context = useContext(EmotionalCheckInContext);
  if (!context) {
    throw new Error('useEmotionalCheckIn must be used within EmotionalCheckInProvider');
  }
  return context;
};
