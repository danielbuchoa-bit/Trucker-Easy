import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from './useNotifications';

const REMINDER_DAYS = 10;
const CHECK_INTERVAL_MS = 1000 * 60 * 60; // Check every hour

export const useDocumentReminders = () => {
  const { permission, requestPermission, sendNotification, isSupported } = useNotifications();
  const hasCheckedRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkDocumentExpiration = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: documents, error } = await supabase
        .from('driver_documents')
        .select('*')
        .eq('user_id', user.id)
        .not('expiration_date', 'is', null);

      if (error || !documents) {
        console.error('[DocumentReminders] Error fetching documents:', error);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const doc of documents) {
        if (!doc.expiration_date) continue;

        const expirationDate = new Date(doc.expiration_date);
        expirationDate.setHours(0, 0, 0, 0);

        const daysUntilExpiration = Math.ceil(
          (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        const docTypeName = doc.document_type === 'cdl' ? 'CDL' : 'Medical Card';

        // Send notification if within reminder window and not already sent
        if (daysUntilExpiration <= REMINDER_DAYS && daysUntilExpiration > 0 && !doc.reminder_sent) {
          sendNotification({
            title: `⚠️ ${docTypeName} Expiring Soon!`,
            body: `Your ${docTypeName} expires in ${daysUntilExpiration} day${daysUntilExpiration !== 1 ? 's' : ''}. Update it before ${expirationDate.toLocaleDateString()}.`,
            tag: `doc-reminder-${doc.id}`,
            requireInteraction: true,
            onClick: () => {
              window.location.href = '/profile';
            },
          });

          // Mark reminder as sent
          await supabase
            .from('driver_documents')
            .update({ reminder_sent: true })
            .eq('id', doc.id);

          console.log(`[DocumentReminders] Sent reminder for ${docTypeName}`);
        }

        // Send urgent notification if expired
        if (daysUntilExpiration <= 0) {
          sendNotification({
            title: `🚨 ${docTypeName} EXPIRED!`,
            body: `Your ${docTypeName} has expired! Update it immediately to stay compliant.`,
            tag: `doc-expired-${doc.id}`,
            requireInteraction: true,
            onClick: () => {
              window.location.href = '/profile';
            },
          });
        }
      }
    } catch (error) {
      console.error('[DocumentReminders] Error checking documents:', error);
    }
  }, [sendNotification]);

  const requestAndCheck = useCallback(async () => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    // Request permission if not granted
    if (permission === 'default' && isSupported) {
      await requestPermission();
    }

    // Initial check
    await checkDocumentExpiration();

    // Set up periodic checking
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(checkDocumentExpiration, CHECK_INTERVAL_MS);
  }, [permission, isSupported, requestPermission, checkDocumentExpiration]);

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        hasCheckedRef.current = false;
        requestAndCheck();
      } else if (event === 'SIGNED_OUT') {
        hasCheckedRef.current = false;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    });

    // Initial check if already logged in
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        requestAndCheck();
      }
    });

    return () => {
      subscription.unsubscribe();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [requestAndCheck]);

  return {
    checkNow: checkDocumentExpiration,
    permission,
    requestPermission,
  };
};
