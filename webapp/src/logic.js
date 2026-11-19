// Pure helpers: dates, repeating to-dos, ingredient parsing. No browser or Firebase imports,
// so tests can run them directly in Node.

export const MEALS = ['breakfast', 'lunch', 'dinner'];
export const CATS = [
  { key: 'groceries', label: 'Groceries' },
  { key: 'household', label: 'Household' },
  { key: 'fun', label: 'Fun' },
];
export const REPEATS = [
  { key: 'none', label: 'Once' }, { key: 'daily', label: 'Daily' }, { key: 'weekly', label: 'Weekly' },
  { key: 'biweekly', label: 'Every 2 weeks' }, { key: 'monthly', label: 'Monthly' },
];
export const REMINDERS = [null, 0, 10, 30, 60, 120, 1440, 2880];

const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
export const addMonths = (d, n) => {
  const day = d.getDate();
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes());
  r.setDate(Math.min(day, new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()));
  return r;
};
export const startOfWeek = (d) => addDays(startOfDay(d), -d.getDay());
export const fmtTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const fmtDay = (d) => d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
export const fmtShort = (d) => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
export const timeStr = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Next due date for a repeating to-do, always after today. */
export function nextDue(current, repeat, today = new Date()) {
  if (!repeat || repeat === 'none') return current;
  const step = (d) => repeat === 'daily' ? addDays(d, 1) : repeat === 'weekly' ? addDays(d, 7)
    : repeat === 'biweekly' ? addDays(d, 14) : addMonths(d, 1);
  let next = step(current ? parseKey(current) : startOfDay(today));
  const t0 = startOfDay(today);
  while (next <= t0) next = step(next);
  return dayKey(next);
}

export function dueLabel(key, today = new Date()) {
  const diff = Math.round((parseKey(key) - startOfDay(today)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${-diff} days overdue`;
  if (diff < 7) return parseKey(key).toLocaleDateString([], { weekday: 'long' });
  return fmtShort(parseKey(key));
}

export function reminderLabel(m) {
  if (m === null || m === undefined) return 'No reminder';
  if (m === 0) return 'At start time';
  if (m < 60) return `${m} min before`;
  if (m < 1440) return `${m / 60} hr before`;
  return m === 1440 ? '1 day before' : `${m / 1440} days before`;
}

/** Every local day an event touches. */
export function eventDays(e) {
  const out = []; let d = startOfDay(new Date(e.start)); const last = startOfDay(new Date(Math.max(e.end || e.start, e.start)));
  while (d <= last && out.length < 60) { out.push(dayKey(d)); d = addDays(d, 1); }
  return out;
}

/** Google Calendar "add event" link; the Google Calendar app then sends phone alerts. */
export function googleCalLink(e) {
  const utc = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dates = e.allDay
    ? `${dayKey(new Date(e.start)).replace(/-/g, '')}/${dayKey(addDays(new Date(e.end || e.start), 1)).replace(/-/g, '')}`
    : `${utc(e.start)}/${utc(e.end || e.start + 3600000)}`;
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates, details: e.notes || '' });
  return `https://calendar.google.com/calendar/render?${p}`;
}

const UNITS = 'cups?|c|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|l|liters?|cloves?|cans?|pinch(?:es)?|dash(?:es)?|slices?|packages?|pkgs?|bunch(?:es)?|sticks?|heads?|large|medium|small';
const ING_LINE = new RegExp(`^\\s*((?:[\\d½¼¾⅓⅔⅛.,/\\- ]+)(?:\\s*(?:${UNITS})\\.?\\b)?)?\\s*(?:of\\s+)?(.+?)\\s*$`, 'i');

/** "2 cups rice" → { quantity: "2 cups", name: "rice" }, one per line. */
export function parseIngredients(text) {
  return text.split('\n').map((l) => l.replace(/^[\s\-•*·▢☐]+/, '').trim()).filter(Boolean).map((line) => {
    const m = ING_LINE.exec(line);
    return m ? { quantity: (m[1] || '').trim(), name: m[2].trim() } : { quantity: '', name: line };
  });
}

export const norm = (s) => s.trim().toLowerCase().replace(/s$/, '');
export const combineQty = (a, b) => (a && b ? `${a} + ${b}` : a || b);

/**
 * Work out how a recipe's ingredients land on the grocery list: which unchecked items get
 * their quantity combined, and which new items to add.
 */
export function planGroceries(ingredients, shopping) {
  const existing = new Map((shopping || []).filter((s) => s.category === 'groceries' && !s.checked).map((s) => [norm(s.name), { id: s.id, quantity: s.quantity || '' }]));
  const updates = new Map(); const additions = new Map();
  for (const ing of ingredients || []) {
    if (!ing.name?.trim()) continue;
    const k = norm(ing.name); const q = (ing.quantity || '').trim();
    if (existing.has(k)) { const s = existing.get(k); s.quantity = combineQty(s.quantity, q); updates.set(s.id, s.quantity); }
    else if (additions.has(k)) additions.get(k).quantity = combineQty(additions.get(k).quantity, q);
    else additions.set(k, { name: ing.name.trim(), quantity: q });
  }
  return { updates: [...updates].map(([id, quantity]) => ({ id, quantity })), additions: [...additions.values()] };
}

/**
 * When an event's reminder should fire (epoch ms), or null for no reminder.
 * All-day events remind relative to 9:00 AM local time on their first day.
 */
export function remindAtFor(e) {
  if (e.reminderMinutes === null || e.reminderMinutes === undefined) return null;
  const base = e.allDay ? new Date(e.start).setHours(9, 0, 0, 0) : e.start;
  return base - e.reminderMinutes * 60000;
}
