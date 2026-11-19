/**
 * HomeIQ notifications, sent as web push through Firebase Cloud Messaging.
 *
 *  - sendEventReminders: every minute, sends reminders whose time has come
 *    (events carry `remindAt`, computed by the website when the event is saved).
 *  - notifyNewEvent: tells the other people in the home when someone adds an event.
 *  - notifyTodoAssigned: tells a person when someone else assigns them a to-do.
 *
 * Each device that turned on notifications stores a token in users/<uid>.webPushTokens.
 */
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

// Set by deploy-notifications.sh to match the database location.
setGlobalOptions({ region: process.env.FUNCTION_REGION || 'us-central1', maxInstances: 5 });

initializeApp();
const db = getFirestore();

const SITE = process.env.SITE_URL || 'https://sarahhouchens-cpu.github.io/ChazelHome/docs/';
// Reminders more than this late (e.g. created after the reminder time) are skipped, not sent.
const STALE_MS = 60 * 60 * 1000;

type Push = { title: string; body: string; path: string };

async function tokensFor(userIds: string[]): Promise<{ uid: string; token: string }[]> {
  if (userIds.length === 0) return [];
  const snaps = await db.getAll(...userIds.map((id) => db.doc(`users/${id}`)));
  return snaps.flatMap((s) => ((s.get('webPushTokens') as string[] | undefined) ?? []).map((token) => ({ uid: s.id, token })));
}

async function firstName(uid: string | undefined): Promise<string> {
  if (!uid) return 'Someone';
  const snap = await db.doc(`users/${uid}`).get();
  return ((snap.get('displayName') as string | undefined) || 'Someone').split(' ')[0];
}

async function send(userIds: string[], push: Push) {
  const targets = await tokensFor(userIds);
  if (targets.length === 0) return;
  const link = SITE + push.path;
  // Data-only message: the site's service worker shows it, so it looks the same everywhere.
  const res = await getMessaging().sendEachForMulticast({
    tokens: targets.map((t) => t.token),
    data: { title: push.title, body: push.body, url: link },
    webpush: { headers: { Urgency: 'high', TTL: '3600' }, fcmOptions: { link } },
  });
  // Forget tokens from devices that turned notifications off or were reset.
  const dead = res.responses
    .map((r, i) => (!r.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(r.error?.code ?? '') ? targets[i] : null))
    .filter((t): t is { uid: string; token: string } => Boolean(t));
  await Promise.all(dead.map((t) => db.doc(`users/${t.uid}`).update({ webPushTokens: FieldValue.arrayRemove(t.token) })));
  logger.info('push sent', { title: push.title, sent: res.successCount, failed: res.failureCount, removed: dead.length });
}

function whenText(start: number, allDay: boolean, tz: string | undefined): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz || 'America/New_York' };
  if (!allDay) Object.assign(opts, { hour: 'numeric', minute: '2-digit' });
  try {
    return new Date(start).toLocaleString('en-US', opts);
  } catch {
    return new Date(start).toLocaleString('en-US', { ...opts, timeZone: 'America/New_York' });
  }
}

function reminderText(minutes: number): string {
  if (minutes === 0) return 'Starting now';
  if (minutes < 60) return `In ${minutes} minutes`;
  if (minutes < 1440) return minutes === 60 ? 'In 1 hour' : `In ${minutes / 60} hours`;
  return minutes === 1440 ? 'Tomorrow' : `In ${minutes / 1440} days`;
}

export const sendEventReminders = onSchedule({ schedule: 'every 1 minutes', timeoutSeconds: 120 }, async () => {
  const now = Date.now();
  const due = await db.collectionGroup('events').where('reminderSent', '==', false).where('remindAt', '<=', now).limit(200).get();
  for (const snap of due.docs) {
    const e = snap.data();
    const homeId = snap.ref.parent.parent?.id;
    // Claim it first so a slow run and the next run never both send it.
    await snap.ref.update({ reminderSent: true });
    if (!homeId || now - (e.remindAt as number) > STALE_MS) continue;
    const home = await db.doc(`homes/${homeId}`).get();
    const members = (home.get('memberIds') as string[] | undefined) ?? [];
    const body = e.allDay
      ? `${reminderText(e.reminderMinutes as number)} · all day`
      : `${reminderText(e.reminderMinutes as number)} · ${whenText(e.start as number, false, e.tz as string | undefined)}`;
    await send(members, { title: e.title as string, body, path: '#calendar' });
  }
});

export const notifyNewEvent = onDocumentCreated('homes/{homeId}/events/{eventId}', async (event) => {
  const e = event.data?.data();
  if (!e) return;
  const home = await db.doc(`homes/${event.params.homeId}`).get();
  const others = ((home.get('memberIds') as string[] | undefined) ?? []).filter((id) => id !== e.createdBy);
  await send(others, {
    title: `${await firstName(e.createdBy)} added an event`,
    body: `${e.title} · ${whenText(e.start, Boolean(e.allDay), e.tz)}`,
    path: '#calendar',
  });
});

export const notifyTodoAssigned = onDocumentWritten('homes/{homeId}/todos/{todoId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after) return;
  const assignee = after.assigneeId as string | null;
  const actor = (after.updatedBy ?? after.createdBy) as string | undefined;
  if (!assignee || assignee === actor || before?.assigneeId === assignee) return;
  await send([assignee], { title: `${await firstName(actor)} assigned you a to-do`, body: after.title as string, path: '#todos' });
});
