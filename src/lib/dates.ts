import type { Recurrence } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-date key, e.g. 2026-11-15. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  const day = d.getDate();
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes());
  const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, lastDay));
  return r;
}

export function startOfWeek(d: Date): Date {
  return addDays(startOfDay(d), -d.getDay());
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/** Next due date for a recurring to-do, always landing after today. */
export function nextDueDate(current: string | null, recurrence: Recurrence, today = new Date()): string | null {
  if (recurrence === 'none') return current;
  const step = (d: Date) => {
    switch (recurrence) {
      case 'daily':
        return addDays(d, 1);
      case 'weekly':
        return addDays(d, 7);
      case 'biweekly':
        return addDays(d, 14);
      case 'monthly':
        return addMonths(d, 1);
    }
  };
  let next = step(current ? parseDayKey(current) : startOfDay(today));
  const todayStart = startOfDay(today);
  while (next <= todayStart) next = step(next);
  return dayKey(next);
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDayLong(d: Date): string {
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatDayShort(d: Date): string {
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function relativeDueLabel(key: string, today = new Date()): string {
  const diff = Math.round((parseDayKey(key).getTime() - startOfDay(today).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${-diff} days overdue`;
  if (diff < 7) return parseDayKey(key).toLocaleDateString([], { weekday: 'long' });
  return formatDayShort(parseDayKey(key));
}
