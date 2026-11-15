import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { formatTime } from './dates';
import { db } from './firebase';
import type { CalendarEvent } from './types';

const REMINDER_KIND = 'event-reminder';
// iOS keeps at most 64 pending local notifications per app; leave headroom.
const MAX_SCHEDULED = 50;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/**
 * Ask for permission and save this device's Expo push token on the user's profile, so the
 * Cloud Function can notify housemates when someone adds an event or assigns a to-do.
 */
export async function registerForPushNotifications(uid: string): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  if (!(await ensurePermission())) return;
  if (!Device.isDevice) return; // Simulators can show local reminders but have no push token.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.info('No EAS projectId configured yet; skipping remote push registration.');
    return;
  }
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await updateDoc(doc(db, 'users', uid), { pushTokens: arrayUnion(token) });
  } catch (err) {
    console.warn('Push registration failed', err);
  }
}

export function reminderLabel(minutes: number | null): string {
  if (minutes === null) return 'None';
  if (minutes === 0) return 'At time of event';
  if (minutes < 60) return `${minutes} min before`;
  if (minutes < 1440) return `${minutes / 60} hr before`;
  const days = minutes / 1440;
  return days === 1 ? '1 day before' : `${days} days before`;
}

export const REMINDER_OPTIONS: (number | null)[] = [null, 0, 10, 30, 60, 120, 1440, 2880];

let syncing: Promise<void> = Promise.resolve();

/**
 * Re-schedule local reminder notifications on this device so they match the shared calendar.
 * Runs whenever the event list changes; calls are serialized so they can't interleave.
 */
export function syncEventReminders(events: CalendarEvent[]): Promise<void> {
  syncing = syncing.then(() => doSync(events)).catch((err) => console.warn('Reminder sync failed', err));
  return syncing;
}

async function doSync(events: CalendarEvent[]) {
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === REMINDER_KIND)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const now = Date.now();
  const upcoming = events
    .filter((e) => e.reminderMinutes !== null)
    .map((e) => {
      // All-day events remind relative to 9am on the day.
      const base = e.allDay ? new Date(e.start).setHours(9, 0, 0, 0) : e.start;
      return { e, fireAt: base - (e.reminderMinutes as number) * 60_000 };
    })
    .filter((x) => x.fireAt > now)
    .sort((a, b) => a.fireAt - b.fireAt)
    .slice(0, MAX_SCHEDULED);

  for (const { e, fireAt } of upcoming) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: e.title,
        body: e.allDay
          ? `${reminderLabel(e.reminderMinutes)} · all day`
          : `${formatTime(e.start)} · ${reminderLabel(e.reminderMinutes)}`,
        data: { kind: REMINDER_KIND, eventId: e.id },
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
  }
}
