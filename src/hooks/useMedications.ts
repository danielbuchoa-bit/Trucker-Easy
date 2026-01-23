import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Medication {
  id: string;
  user_id: string;
  name: string;
  dosage_text: string;
  schedule_type: 'daily' | 'weekly';
  times_of_day: string[];
  days_of_week: number[];
  reminder_minutes_before: number;
  snooze_enabled: boolean;
  snooze_options: number[];
  paused: boolean;
  driving_modal_disabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicationLog {
  id: string;
  medication_id: string;
  user_id: string;
  scheduled_at: string;
  action: 'taken' | 'snoozed' | 'skipped';
  action_at: string;
  snooze_minutes: number | null;
  created_at: string;
}

export interface MedicationFormData {
  name: string;
  dosage_text: string;
  schedule_type: 'daily' | 'weekly';
  times_of_day: string[];
  days_of_week: number[];
  reminder_minutes_before: number;
  snooze_enabled: boolean;
  snooze_options: number[];
  driving_modal_disabled: boolean;
  notes: string;
}

export const useMedications = () => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchMedications = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMedications([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setMedications((data || []) as Medication[]);
    } catch (err) {
      console.error('Error fetching medications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch medications');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async (days: number = 7) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('medication_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('scheduled_at', startDate.toISOString())
        .order('scheduled_at', { ascending: false });

      if (error) throw error;
      setLogs((data || []) as MedicationLog[]);
    } catch (err) {
      console.error('Error fetching medication logs:', err);
    }
  }, []);

  const addMedication = useCallback(async (formData: MedicationFormData): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Erro',
          description: 'Você precisa estar logado para adicionar medicamentos',
          variant: 'destructive',
        });
        return false;
      }

      const { error } = await supabase
        .from('medications')
        .insert({
          user_id: user.id,
          name: formData.name,
          dosage_text: formData.dosage_text,
          schedule_type: formData.schedule_type,
          times_of_day: formData.times_of_day,
          days_of_week: formData.days_of_week,
          reminder_minutes_before: formData.reminder_minutes_before,
          snooze_enabled: formData.snooze_enabled,
          snooze_options: formData.snooze_options,
          driving_modal_disabled: formData.driving_modal_disabled,
          notes: formData.notes || null,
        });

      if (error) throw error;

      toast({
        title: 'Medicamento adicionado',
        description: `${formData.name} foi adicionado com sucesso`,
      });

      await fetchMedications();
      return true;
    } catch (err) {
      console.error('Error adding medication:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar o medicamento',
        variant: 'destructive',
      });
      return false;
    }
  }, [fetchMedications, toast]);

  const updateMedication = useCallback(async (id: string, formData: Partial<MedicationFormData>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('medications')
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Medicamento atualizado',
        description: 'As alterações foram salvas',
      });

      await fetchMedications();
      return true;
    } catch (err) {
      console.error('Error updating medication:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o medicamento',
        variant: 'destructive',
      });
      return false;
    }
  }, [fetchMedications, toast]);

  const togglePause = useCallback(async (id: string, paused: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('medications')
        .update({ paused, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: paused ? 'Medicamento pausado' : 'Medicamento reativado',
        description: paused 
          ? 'Os lembretes foram pausados' 
          : 'Os lembretes foram reativados',
      });

      await fetchMedications();
      return true;
    } catch (err) {
      console.error('Error toggling medication pause:', err);
      return false;
    }
  }, [fetchMedications, toast]);

  const deleteMedication = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('medications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Medicamento excluído',
        description: 'O medicamento foi removido da sua lista',
      });

      await fetchMedications();
      return true;
    } catch (err) {
      console.error('Error deleting medication:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o medicamento',
        variant: 'destructive',
      });
      return false;
    }
  }, [fetchMedications, toast]);

  const logAction = useCallback(async (
    medicationId: string,
    scheduledAt: Date,
    action: 'taken' | 'snoozed' | 'skipped',
    snoozeMinutes?: number
  ): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('medication_logs')
        .insert({
          medication_id: medicationId,
          user_id: user.id,
          scheduled_at: scheduledAt.toISOString(),
          action,
          action_at: new Date().toISOString(),
          snooze_minutes: snoozeMinutes || null,
        });

      if (error) throw error;
      await fetchLogs();
      return true;
    } catch (err) {
      console.error('Error logging medication action:', err);
      return false;
    }
  }, [fetchLogs]);

  // Calculate adherence percentage
  const getAdherenceStats = useCallback((days: number = 7) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const relevantLogs = logs.filter(log => 
      new Date(log.scheduled_at) >= startDate
    );

    const total = relevantLogs.length;
    const taken = relevantLogs.filter(log => log.action === 'taken').length;
    const skipped = relevantLogs.filter(log => log.action === 'skipped').length;
    const snoozed = relevantLogs.filter(log => log.action === 'snoozed').length;

    return {
      total,
      taken,
      skipped,
      snoozed,
      adherencePercent: total > 0 ? Math.round((taken / total) * 100) : 0,
    };
  }, [logs]);

  // Get next scheduled reminder for a medication
  const getNextReminder = useCallback((medication: Medication): Date | null => {
    if (medication.paused || medication.times_of_day.length === 0) return null;

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    // Sort times
    const sortedTimes = [...medication.times_of_day].sort();

    // Check today's remaining times
    if (medication.schedule_type === 'daily' || medication.days_of_week.includes(currentDay)) {
      for (const time of sortedTimes) {
        const [hours, minutes] = time.split(':').map(Number);
        const timeMinutes = hours * 60 + minutes;
        if (timeMinutes > currentTime) {
          const next = new Date(now);
          next.setHours(hours, minutes, 0, 0);
          return next;
        }
      }
    }

    // Find next valid day
    for (let i = 1; i <= 7; i++) {
      const checkDay = (currentDay + i) % 7;
      if (medication.schedule_type === 'daily' || medication.days_of_week.includes(checkDay)) {
        const [hours, minutes] = sortedTimes[0].split(':').map(Number);
        const next = new Date(now);
        next.setDate(next.getDate() + i);
        next.setHours(hours, minutes, 0, 0);
        return next;
      }
    }

    return null;
  }, []);

  useEffect(() => {
    fetchMedications();
    fetchLogs();
  }, [fetchMedications, fetchLogs]);

  return {
    medications,
    logs,
    loading,
    error,
    fetchMedications,
    fetchLogs,
    addMedication,
    updateMedication,
    togglePause,
    deleteMedication,
    logAction,
    getAdherenceStats,
    getNextReminder,
  };
};
