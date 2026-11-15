/**
 * Push notifications between housemates, sent through Expo's push service.
 *  - Someone adds a calendar event  → everyone else in the home is notified.
 *  - A to-do is assigned to you by someone else → you are notified.
 *
 * Timed event reminders ("30 min before") are scheduled on each phone by the app itself,
 * so they work even without this function deployed.
 */
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';

initializeApp();
const db = getFirestore();

type PushMessage = { to: string; title: string; body: string; data?: Record<string, unknown>; sound: 'default' };

async function tokensFor(userIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (userIds.length === 0) return out;
  const snaps = await db.getAll(...userIds.map((id) => db.doc(`users/${id}`)));
  for (const s of snaps) out.set(s.id, (s.get('pushTokens') as string[] | undefined) ?? []);
  return out;
}

async function displayName(userId: string | undefined): Promise<string> {
  if (!userId) return 'Someone';
  const snap = await db.doc(`users/${userId}`).get();
  return ((snap.get('displayName') as string | undefined) ?? 'Someone').split(' ')[0];
}

async function sendPush(byUser: Map<string, string[]>, msg: Omit<PushMessage, 'to' | 'sound'>) {
  const pairs = [...byUser].flatMap(([uid, tokens]) => tokens.map((to) => ({ uid, to })));
  if (pairs.length === 0) return;
  const messages: PushMessage[] = pairs.map(({ to }) => ({ to, sound: 'default', ...msg }));
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
  // Forget tokens for uninstalled apps so we stop sending to them.
  await Promise.all(
    (json.data ?? []).map((ticket, i) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        const { uid, to } = pairs[i];
        return db.doc(`users/${uid}`).update({ pushTokens: FieldValue.arrayRemove(to) });
      }
      return null;
    }),
  );
}

export const notifyNewEvent = onDocumentCreated('homes/{homeId}/events/{eventId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;
  const home = await db.doc(`homes/${event.params.homeId}`).get();
  const others = ((home.get('memberIds') as string[]) ?? []).filter((id) => id !== data.createdBy);
  const who = await displayName(data.createdBy);
  const when = new Date(data.start as number).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(data.allDay ? {} : { hour: 'numeric', minute: '2-digit' }),
    timeZone: process.env.HOME_TIMEZONE ?? 'America/New_York',
  });
  await sendPush(await tokensFor(others), {
    title: `${who} added to the calendar`,
    body: `${data.title} · ${when}`,
    data: { kind: 'event', eventId: event.params.eventId },
  });
  logger.info('Notified housemates of new event', { homeId: event.params.homeId, count: others.length });
});

export const notifyTodoAssigned = onDocumentWritten('homes/{homeId}/todos/{todoId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after) return;
  const assignee = after.assigneeId as string | null;
  const actor = after.updatedBy as string | undefined;
  if (!assignee || assignee === actor || before?.assigneeId === assignee) return;
  const who = await displayName(actor);
  await sendPush(await tokensFor([assignee]), {
    title: `${who} assigned you a to-do`,
    body: after.title as string,
    data: { kind: 'todo', todoId: event.params.todoId },
  });
});
