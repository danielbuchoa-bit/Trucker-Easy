import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  onClick?: () => void;
}

interface UseNotificationsReturn {
  permission: NotificationPermission | 'unsupported';
  requestPermission: () => Promise<boolean>;
  sendNotification: (options: NotificationOptions) => void;
  isSupported: boolean;
}

export const useNotifications = (): UseNotificationsReturn => {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  useEffect(() => {
    if (isSupported) {
      setPermission(Notification.permission);
    } else {
      setPermission('unsupported');
    }
  }, [isSupported]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.log('[Notifications] Not supported in this browser');
      return false;
    }

    if (Notification.permission === 'granted') {
      setPermission('granted');
      return true;
    }

    if (Notification.permission === 'denied') {
      setPermission('denied');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('[Notifications] Error requesting permission:', error);
      return false;
    }
  }, [isSupported]);

  const sendNotification = useCallback((options: NotificationOptions) => {
    const { title, body, icon, tag, requireInteraction, onClick } = options;

    // If notifications are supported and granted, use native notification
    if (isSupported && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: icon || '/favicon.ico',
          tag: tag || 'poi-feedback',
          requireInteraction: requireInteraction ?? false,
          badge: '/favicon.ico',
        });

        if (onClick) {
          notification.onclick = () => {
            window.focus();
            notification.close();
            onClick();
          };
        }

        // Auto-close after 10 seconds if not require interaction
        if (!requireInteraction) {
          setTimeout(() => notification.close(), 10000);
        }

        console.log('[Notifications] Native notification sent:', title);
        return;
      } catch (error) {
        console.error('[Notifications] Failed to send native notification:', error);
      }
    }

    // Fallback to toast notification with action
    if (onClick) {
      toast(title, {
        description: body,
        duration: 10000,
        action: {
          label: 'Avaliar',
          onClick: onClick,
        },
      });
    } else {
      toast(title, {
        description: body,
        duration: 8000,
      });
    }
    
    console.log('[Notifications] Toast fallback sent:', title);
  }, [isSupported]);

  return {
    permission,
    requestPermission,
    sendNotification,
    isSupported,
  };
};
