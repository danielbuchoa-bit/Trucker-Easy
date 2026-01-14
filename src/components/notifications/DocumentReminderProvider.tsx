import { useDocumentReminders } from '@/hooks/useDocumentReminders';

/**
 * Provider component that initializes document expiration reminders.
 * This runs in the background and sends push notifications when
 * documents (CDL, Medical Card) are expiring within 10 days.
 */
export const DocumentReminderProvider = () => {
  useDocumentReminders();
  return null;
};
