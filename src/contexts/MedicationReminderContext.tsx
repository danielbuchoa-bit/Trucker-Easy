import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useMedications, Medication } from '@/hooks/useMedications';
import { useToast } from '@/hooks/use-toast';
import MedicationReminderModal from '@/components/medication/MedicationReminderModal';
import MedicationReminderBanner from '@/components/medication/MedicationReminderBanner';

interface PendingReminder {
  medication: Medication;
  scheduledTime: Date;
}

interface MedicationReminderContextValue {
  pendingReminders: PendingReminder[];
  isDrivingMode: boolean;
  setDrivingMode: (driving: boolean) => void;
  dismissReminder: (medicationId: string) => void;
  checkReminders: () => void;
}

const MedicationReminderContext = createContext<MedicationReminderContextValue | null>(null);

export const useMedicationReminders = () => {
  const context = useContext(MedicationReminderContext);
  if (!context) {
    throw new Error('useMedicationReminders must be used within MedicationReminderProvider');
  }
  return context;
};

export const MedicationReminderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { medications, logAction, fetchLogs } = useMedications();
  const { toast } = useToast();
  
  const [pendingReminders, setPendingReminders] = useState<PendingReminder[]>([]);
  const [isDrivingMode, setDrivingMode] = useState(false);
  const [activeReminder, setActiveReminder] = useState<PendingReminder | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  const lastCheckedRef = useRef<Map<string, number>>(new Map());
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if a reminder should fire
  const shouldFireReminder = useCallback((medication: Medication): { shouldFire: boolean; scheduledTime: Date | null } => {
    if (medication.paused) return { shouldFire: false, scheduledTime: null };

    const now = new Date();
    const currentDay = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Check schedule type
    if (medication.schedule_type === 'weekly' && !medication.days_of_week.includes(currentDay)) {
      return { shouldFire: false, scheduledTime: null };
    }

    // Check each scheduled time
    for (const time of medication.times_of_day) {
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledMinutes = hours * 60 + minutes;
      const reminderMinutes = scheduledMinutes - medication.reminder_minutes_before;

      // Allow a 2-minute window for the reminder
      if (currentMinutes >= reminderMinutes && currentMinutes <= scheduledMinutes + 2) {
        // Check if we already fired this reminder today
        const todayKey = `${medication.id}-${now.toDateString()}-${time}`;
        const lastFired = lastCheckedRef.current.get(todayKey);
        
        if (!lastFired || Date.now() - lastFired > 30 * 60 * 1000) { // 30 min cooldown
          lastCheckedRef.current.set(todayKey, Date.now());
          
          const scheduledTime = new Date(now);
          scheduledTime.setHours(hours, minutes, 0, 0);
          
          return { shouldFire: true, scheduledTime };
        }
      }
    }

    return { shouldFire: false, scheduledTime: null };
  }, []);

  // Check all medications for reminders
  const checkReminders = useCallback(() => {
    const newReminders: PendingReminder[] = [];

    medications.forEach(medication => {
      const { shouldFire, scheduledTime } = shouldFireReminder(medication);
      if (shouldFire && scheduledTime) {
        // Check if already in pending
        const exists = pendingReminders.some(r => r.medication.id === medication.id);
        if (!exists) {
          newReminders.push({ medication, scheduledTime });
        }
      }
    });

    if (newReminders.length > 0) {
      setPendingReminders(prev => [...prev, ...newReminders]);
      
      // Show the first new reminder
      if (!activeReminder) {
        const reminder = newReminders[0];
        setActiveReminder(reminder);
        
        // In driving mode, show banner and toast instead of modal
        if (isDrivingMode && reminder.medication.driving_modal_disabled) {
          toast({
            title: `💊 ${reminder.medication.name}`,
            description: reminder.medication.dosage_text,
            duration: 10000,
          });
        } else {
          setShowModal(true);
        }
      }
    }
  }, [medications, shouldFireReminder, pendingReminders, activeReminder, isDrivingMode, toast]);

  // Handle reminder actions
  const handleTaken = useCallback(async () => {
    if (!activeReminder) return;
    
    await logAction(activeReminder.medication.id, activeReminder.scheduledTime, 'taken');
    
    toast({
      title: '✅ Medicamento registrado',
      description: `${activeReminder.medication.name} marcado como tomado`,
    });
    
    setPendingReminders(prev => prev.filter(r => r.medication.id !== activeReminder.medication.id));
    setShowModal(false);
    setActiveReminder(null);
  }, [activeReminder, logAction, toast]);

  const handleSnooze = useCallback(async (minutes: number) => {
    if (!activeReminder) return;
    
    await logAction(activeReminder.medication.id, activeReminder.scheduledTime, 'snoozed', minutes);
    
    // Remove from pending, will be re-added when snooze expires
    const snoozedKey = `${activeReminder.medication.id}-snooze`;
    lastCheckedRef.current.delete(snoozedKey);
    
    // Schedule snooze reminder
    setTimeout(() => {
      setPendingReminders(prev => [...prev, activeReminder]);
      toast({
        title: `💊 Lembrete: ${activeReminder.medication.name}`,
        description: 'Hora de tomar seu medicamento!',
      });
    }, minutes * 60 * 1000);
    
    toast({
      title: '⏰ Adiado',
      description: `Você será lembrado em ${minutes} minutos`,
    });
    
    setPendingReminders(prev => prev.filter(r => r.medication.id !== activeReminder.medication.id));
    setShowModal(false);
    setActiveReminder(null);
  }, [activeReminder, logAction, toast]);

  const handleSkip = useCallback(async () => {
    if (!activeReminder) return;
    
    await logAction(activeReminder.medication.id, activeReminder.scheduledTime, 'skipped');
    
    setPendingReminders(prev => prev.filter(r => r.medication.id !== activeReminder.medication.id));
    setShowModal(false);
    setActiveReminder(null);
  }, [activeReminder, logAction]);

  const dismissReminder = useCallback((medicationId: string) => {
    setPendingReminders(prev => prev.filter(r => r.medication.id !== medicationId));
    if (activeReminder?.medication.id === medicationId) {
      setActiveReminder(null);
      setShowModal(false);
    }
  }, [activeReminder]);

  // Set up periodic check
  useEffect(() => {
    // Initial check
    if (medications.length > 0) {
      checkReminders();
    }

    // Check every 30 seconds
    checkIntervalRef.current = setInterval(() => {
      checkReminders();
    }, 30000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [medications, checkReminders]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Show notification when app is in background
  useEffect(() => {
    if (activeReminder && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(`💊 ${activeReminder.medication.name}`, {
        body: activeReminder.medication.dosage_text,
        icon: '/favicon.ico',
        tag: activeReminder.medication.id,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        setShowModal(true);
      };
    }
  }, [activeReminder]);

  const contextValue: MedicationReminderContextValue = {
    pendingReminders,
    isDrivingMode,
    setDrivingMode,
    dismissReminder,
    checkReminders,
  };

  // Get banner reminder (first pending in driving mode)
  const bannerReminder = isDrivingMode && pendingReminders.length > 0 && 
    pendingReminders[0].medication.driving_modal_disabled ? pendingReminders[0] : null;

  return (
    <MedicationReminderContext.Provider value={contextValue}>
      {children}

      {/* Modal for non-driving mode */}
      <MedicationReminderModal
        open={showModal && (!isDrivingMode || !activeReminder?.medication.driving_modal_disabled)}
        medication={activeReminder?.medication || null}
        scheduledTime={activeReminder?.scheduledTime || null}
        onTaken={handleTaken}
        onSnooze={handleSnooze}
        onSkip={handleSkip}
        onClose={() => setShowModal(false)}
      />

      {/* Banner for driving mode */}
      {bannerReminder && (
        <MedicationReminderBanner
          medication={bannerReminder.medication}
          onTaken={handleTaken}
          onSnooze={() => handleSnooze(bannerReminder.medication.snooze_options[0] || 10)}
          onDismiss={() => dismissReminder(bannerReminder.medication.id)}
        />
      )}
    </MedicationReminderContext.Provider>
  );
};
