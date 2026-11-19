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
  { key: 'monthly', label: 'Monthly' }, { key: 'yearly', label: 'Yearly' },
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

// ---------- repeating to-dos ----------
// A rule is 'none' or an object:
//   { freq: 'daily' | 'weekly' | 'monthly' | 'yearly', interval: n,
//     weekdays: [0-6]            (weekly; 0 = Sunday)
//     monthMode: 'date' | 'weekday', monthDay: 1-31 | -1 (last),   (monthly by date)
//     nth: 1-4 | -1 (last), weekday: 0-6 }                          (monthly by weekday)
// Older to-dos stored 'daily' | 'weekly' | 'biweekly' | 'monthly'; normalizeRule reads both.

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const lastDayOf = (y, m) => new Date(y, m + 1, 0).getDate();
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 >= 11 && n % 100 <= 13) ? 0 : n % 10] || 'th');
const NTH = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', '-1': 'last' };

/** Which week of its month a date falls in (1-4), and whether it's the last such weekday. */
/** Which occurrence of its weekday a date is in its month (1-5), and whether it's the last one. */
export function weekdayPosition(d) {
  return { nth: Math.ceil(d.getDate() / 7), last: d.getDate() + 7 > lastDayOf(d.getFullYear(), d.getMonth()), weekday: d.getDay() };
}

/**
 * The ways a monthly repeat can follow a start date, in plain words:
 * "the 22nd", "the fourth Sunday", "the last Sunday", "the last day".
 */
export function monthlyChoices(startKey) {
  const d = parseKey(startKey); const pos = weekdayPosition(d);
  const out = [{ key: 'date', label: `the ${ordinal(d.getDate())}`, patch: { monthMode: 'date', monthDay: d.getDate() } }];
  if (pos.nth <= 4) out.push({ key: 'nth', label: `the ${NTH[pos.nth]} ${WEEKDAY_LONG[pos.weekday]}`, patch: { monthMode: 'weekday', nth: pos.nth, weekday: pos.weekday } });
  if (pos.last) out.push({ key: 'lastwd', label: `the last ${WEEKDAY_LONG[pos.weekday]}`, patch: { monthMode: 'weekday', nth: -1, weekday: pos.weekday } });
  if (d.getDate() === lastDayOf(d.getFullYear(), d.getMonth())) out.push({ key: 'lastday', label: 'the last day', patch: { monthMode: 'date', monthDay: -1 } });
  return out;
}

const sameRuleBits = (rule, patch) => Object.entries(patch).every(([k, v]) => rule[k] === v);

/** Which plain choice a monthly rule matches for this start date, or null for a custom rule. */
export function monthlyChoiceKey(rule, startKey) {
  if (rule === 'none' || rule.freq !== 'monthly') return null;
  const mode = rule.monthMode === 'weekday' ? 'weekday' : 'date';
  const hit = monthlyChoices(startKey).find((c) => c.patch.monthMode === mode && sameRuleBits(rule, c.patch));
  return hit ? hit.key : null;
}

/** When the start date changes, move a rule that followed the old date to follow the new one. */
export function retargetRule(rule, oldKey, newKey) {
  if (rule === 'none' || !oldKey || !newKey || oldKey === newKey) return rule;
  const n = parseKey(newKey);
  if (rule.freq === 'weekly') {
    const was = parseKey(oldKey).getDay();
    return rule.weekdays?.length === 1 && rule.weekdays[0] === was ? { ...rule, weekdays: [n.getDay()] } : rule;
  }
  if (rule.freq === 'yearly') return { ...rule, month: n.getMonth(), day: n.getDate() };
  if (rule.freq === 'monthly') {
    const key = monthlyChoiceKey(rule, oldKey);
    if (!key) return rule; // a custom choice stays as chosen
    const choices = monthlyChoices(newKey);
    const same = choices.find((c) => c.key === key) || choices.find((c) => c.patch.monthMode === (rule.monthMode === 'weekday' ? 'weekday' : 'date')) || choices[0];
    return { ...rule, ...same.patch };
  }
  return rule;
}

/** A sensible rule of the given kind, anchored on a start date. */
export function defaultRule(freq, startKey) {
  if (freq === 'none') return 'none';
  const d = parseKey(startKey);
  const rule = { freq, interval: 1 };
  if (freq === 'weekly') rule.weekdays = [d.getDay()];
  if (freq === 'monthly') { const pos = weekdayPosition(d); Object.assign(rule, { monthMode: 'date', monthDay: d.getDate(), nth: pos.nth <= 4 ? pos.nth : -1, weekday: d.getDay() }); }
  if (freq === 'yearly') Object.assign(rule, { month: d.getMonth(), day: d.getDate() });
  return rule;
}

export function normalizeRule(r, anchorKey) {
  if (!r || r === 'none') return 'none';
  if (typeof r === 'object') return { interval: 1, ...r, interval: Math.max(1, Number(r.interval) || 1) };
  const anchor = anchorKey || dayKey(new Date());
  if (r === 'daily') return defaultRule('daily', anchor);
  if (r === 'weekly') return defaultRule('weekly', anchor);
  if (r === 'biweekly') return { ...defaultRule('weekly', anchor), interval: 2 };
  if (r === 'monthly') return defaultRule('monthly', anchor);
  return 'none';
}

function nthWeekdayOf(y, m, nth, weekday) {
  if (nth === -1) {
    const last = new Date(y, m, lastDayOf(y, m));
    return addDays(last, -((last.getDay() - weekday + 7) % 7));
  }
  const first = new Date(y, m, 1);
  return new Date(y, m, 1 + ((weekday - first.getDay() + 7) % 7) + (nth - 1) * 7);
}

function dateInMonth(y, m, rule, yearlyDay) {
  if (rule.freq === 'yearly') return new Date(y, m, Math.min(yearlyDay, lastDayOf(y, m)));
  if (rule.monthMode === 'weekday') return nthWeekdayOf(y, m, rule.nth, rule.weekday);
  return new Date(y, m, rule.monthDay === -1 ? lastDayOf(y, m) : Math.min(rule.monthDay, lastDayOf(y, m)));
}

/** First occurrence of the rule strictly after `fromKey`, counting intervals from `fromKey`. */
function nextAfter(fromKey, rule) {
  const from = parseKey(fromKey);
  const n = rule.interval || 1;
  if (rule.freq === 'daily') return addDays(from, n);
  if (rule.freq === 'weekly') {
    const days = rule.weekdays?.length ? rule.weekdays : [from.getDay()];
    const week0 = startOfWeek(from);
    for (let i = 1; i <= 7 * n + 7; i++) {
      const d = addDays(from, i);
      const weeks = Math.round((startOfWeek(d) - week0) / (7 * 86400000));
      if (weeks % n === 0 && days.includes(d.getDay())) return d;
    }
    return addDays(from, 7 * n);
  }
  // monthly / yearly: try this period, then every `n` months (or 12n for yearly).
  const step = rule.freq === 'yearly' ? 12 * n : n;
  const month = rule.freq === 'yearly' ? (rule.month ?? from.getMonth()) : from.getMonth();
  const yearlyDay = rule.day ?? from.getDate();
  for (let k = 0; k < 400; k += step) {
    const ref = new Date(from.getFullYear(), month + k, 1);
    const d = dateInMonth(ref.getFullYear(), ref.getMonth(), rule, yearlyDay);
    if (d > from) return d;
  }
  return addMonths(from, step);
}

/** The first date on or after `startKey` that fits the rule (used when a to-do is saved). */
export function firstDue(startKey, rule) {
  const r = normalizeRule(rule, startKey);
  if (r === 'none') return startKey;
  return dayKey(nextAfter(dayKey(addDays(parseKey(startKey), -1)), { ...r, interval: 1 }));
}

/** Next due date for a repeating to-do after it's checked off, always after today. */
export function nextDue(current, repeat, today = new Date()) {
  const rule = normalizeRule(repeat, current);
  if (rule === 'none') return current;
  const t0 = startOfDay(today);
  let next = nextAfter(current || dayKey(t0), rule);
  for (let guard = 0; next <= t0 && guard < 1000; guard++) next = nextAfter(dayKey(next), rule);
  return dayKey(next);
}

/** "Every 2 weeks on Mon, Thu", "Monthly on the last Friday", … */
export function describeRule(repeat, anchorKey) {
  const r = normalizeRule(repeat, anchorKey);
  if (r === 'none') return 'Once';
  const n = r.interval || 1;
  const every = (unit, plural) => (n === 1 ? unit : `Every ${n} ${plural}`);
  if (r.freq === 'daily') return n === 1 ? 'Every day' : `Every ${n} days`;
  if (r.freq === 'weekly') {
    const days = [...(r.weekdays || [])].sort();
    const list = days.length === 7 ? 'every day' : days.length === 5 && !days.includes(0) && !days.includes(6) ? 'weekdays' : days.map((d) => WEEKDAY_SHORT[d]).join(', ');
    return `${every('Weekly', 'weeks')} on ${list}`;
  }
  if (r.freq === 'monthly') {
    const on = r.monthMode === 'weekday' ? `the ${NTH[r.nth]} ${WEEKDAY_LONG[r.weekday]}` : r.monthDay === -1 ? 'the last day' : `the ${ordinal(r.monthDay)}`;
    return `${every('Monthly', 'months')} on ${on}`;
  }
  const a = r.month !== undefined ? new Date(2001, r.month, r.day) : anchorKey ? parseKey(anchorKey) : new Date();
  return `${every('Yearly', 'years')} on ${a.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
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

const LEFTOVER_PREFIX = /^leftovers:\s*/i;

/**
 * Meals eaten in the few days before `date`/`meal` that could be leftovers, newest first.
 * Leftovers of leftovers count as the original dish, and each dish appears once.
 */
export function leftoverOptions(menu, date, meal, days = 4) {
  const from = dayKey(addDays(parseKey(date), -days));
  const before = (m) => m.date < date || (m.date === date && MEALS.indexOf(m.meal) < MEALS.indexOf(meal));
  const seen = new Set(); const out = [];
  const sorted = (menu || []).filter((m) => m.date >= from && before(m))
    .sort((a, b) => b.date.localeCompare(a.date) || MEALS.indexOf(b.meal) - MEALS.indexOf(a.meal));
  for (const m of sorted) {
    const title = (m.title || '').replace(LEFTOVER_PREFIX, '').trim();
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    out.push({ title, date: m.date, meal: m.meal, recipeId: m.recipeId || null });
  }
  return out;
}

/** Who an event is for: its attendees, or everyone in the home when none are set. */
export function eventPeople(e, memberIds) {
  const set = (e.attendeeIds || []).filter((id) => memberIds.includes(id));
  return set.length ? set : memberIds;
}
