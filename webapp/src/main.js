import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import * as api from './backend.js';
import {
  CATS, MEALS, REMINDERS, REPEATS, addDays, addMonths, dayKey, dueLabel, eventDays, fmtDay, fmtShort, fmtTime,
  googleCalLink, nextDue, parseIngredients, parseKey, planGroceries, reminderLabel, startOfDay, startOfWeek, timeStr,
} from './logic.js';

const html = htm.bind(React.createElement);

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'lists', label: 'Lists' },
  { id: 'menu', label: 'Menu' },
  { id: 'todos', label: 'To-Do' },
  { id: 'household', label: 'Household' },
];
const COLLECTIONS = ['events', 'shopping', 'recipes', 'menu', 'todos'];

// ---------- small components ----------
function Avatar({ p, lg }) {
  if (p?.avatarUrl) return html`<img className=${'avatar' + (lg ? ' lg' : '')} src=${p.avatarUrl} alt="" />`;
  const ini = (p?.name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return html`<span className=${'initials' + (lg ? ' lg' : '')} style=${{ background: p?.color || 'var(--muted)' }} aria-hidden="true">${ini}</span>`;
}
function Chip({ on, onClick, children, color, className }) {
  return html`<button type="button" className=${'chip ' + (className || '')} aria-pressed=${on ? 'true' : 'false'} onClick=${onClick} style=${color ? { '--chip': color } : null}>${children}</button>`;
}
function Empty({ title, children }) {
  return html`<div className="empty"><strong>${title}</strong><div>${children}</div></div>`;
}
function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return html`<div className="scrim" onMouseDown=${(e) => e.target === e.currentTarget && onClose()}>
    <div className="sheet" role="dialog" aria-modal="true" aria-label=${title}>
      <div className="between"><h2>${title}</h2><button className="iconbtn" aria-label="Close" onClick=${onClose}>✕</button></div>
      ${children}
    </div></div>`;
}
function ConfirmDelete({ label, onConfirm }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return html`<button className="btn danger" onClick=${() => setAsking(true)}>${label}</button>`;
  return html`<div className="confirm"><span className="grow">Delete for everyone in the home?</span>
    <button className="btn sm ghost" onClick=${() => setAsking(false)}>Keep</button>
    <button className="btn sm" style=${{ background: 'var(--warn)' }} onClick=${onConfirm}>Delete</button></div>`;
}
function Field({ label, children }) { return html`<label className="field"><span>${label}</span>${children}</label>`; }

// ---------- app shell ----------
function useHash() {
  const read = () => { const h = location.hash.slice(1); return TABS.some((t) => t.id === h) ? h : 'today'; };
  const [tab, setTab] = useState(read);
  useEffect(() => { const f = () => setTab(read()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return tab;
}

function Brand({ sub }) {
  return html`<div className="brand"><span className="mark" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 7.5 8 2.5l6 5V14H9.5v-4h-3v4H2z" fill="var(--accent-ink)"/></svg></span>Home<span className="iq">IQ</span>${sub && html`<span className="homename" style=${{ marginLeft: 8 }}>${sub}</span>`}</div>`;
}

function useToast() {
  const [toast, setToast] = useState(null);
  const say = (msg) => { setToast(msg); clearTimeout(say.t); say.t = setTimeout(() => setToast(null), 3600); };
  const node = toast && html`<div className="toast" role="status">${toast}</div>`;
  return [say, node];
}

function Root() {
  const [authState, setAuthState] = useState({ ready: false, uid: null });
  const [profile, setProfile] = useState(undefined); // undefined = loading
  const [home, setHome] = useState(undefined);

  useEffect(() => api.onAuth((u) => { setAuthState({ ready: true, uid: u?.uid || null }); if (!u) setProfile(null); }), []);
  useEffect(() => {
    if (!authState.uid) return;
    setProfile(undefined);
    return api.watchUser(authState.uid, setProfile, () => setProfile(null));
  }, [authState.uid]);
  const homeId = profile?.homeId || null;
  useEffect(() => {
    if (!homeId) { setHome(null); return; }
    setHome(undefined);
    // Right after creating or joining, the profile can update a moment before the server has
    // the new membership, so a first "no access" is retried a few times. If the home stays
    // unreadable (you left, or were removed), fall back to setup.
    let unsub = () => {}; let tries = 0; let timer; let alive = true;
    const listen = () => {
      unsub = api.watchHome(homeId, (h) => { tries = 0; setHome(h); }, () => {
        if (!alive) return;
        if (tries++ < 5) timer = setTimeout(listen, 600 * tries);
        else setHome(null);
      });
    };
    listen();
    return () => { alive = false; clearTimeout(timer); unsub(); };
  }, [homeId]);

  if (!authState.ready || (authState.uid && profile === undefined) || (homeId && home === undefined)) return html`<${Loading} />`;
  if (!authState.uid) return html`<${SignIn} />`;
  if (!home) return html`<${Onboarding} profile=${profile} />`;
  return html`<${App} uid=${authState.uid} home=${home} />`;
}

function Loading() {
  return html`<header className="top"><div className="wrap"><div className="toprow"><${Brand} /></div></div></header>
    <main className="wrap"><div className="skeleton"></div><div className="skeleton"></div></main>`;
}

function AuthFrame({ children }) {
  return html`<main className="wrap auth"><div className="stack" style=${{ gap: 6, alignItems: 'flex-start' }}><${Brand} /></div>${children}</main>`;
}

function SignIn() {
  const [mode, setMode] = useState('in');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setMsg(null);
    if (mode === 'up' && !f.name.trim()) return setMsg({ err: true, text: 'Enter your name.' });
    setBusy(true);
    try { mode === 'up' ? await api.signUp(f.name, f.email, f.password) : await api.signIn(f.email, f.password); }
    catch (err) { setMsg({ err: true, text: api.friendlyError(err) }); setBusy(false); }
  };
  const forgot = async () => {
    if (!f.email.trim()) return setMsg({ err: true, text: 'Enter your email first, then tap “Forgot password?” again.' });
    try { await api.resetPassword(f.email); setMsg({ text: 'Password reset email sent. Check your inbox.' }); }
    catch (err) { setMsg({ err: true, text: api.friendlyError(err) }); }
  };
  return html`<${AuthFrame}>
    <h1>${mode === 'in' ? 'Welcome home' : 'Create your account'}</h1>
    <p className="muted" style=${{ margin: 0 }}>${mode === 'in' ? 'Sign in to see your household’s calendar, lists, menu and to-dos.' : 'Each person in your home gets their own account. You’ll create or join a home next.'}</p>
    <form className="card" onSubmit=${submit}>
      ${mode === 'up' && html`<${Field} label="Your name"><input id="au-name" type="text" autoComplete="given-name" value=${f.name} onChange=${set('name')} /><//>`}
      <${Field} label="Email"><input id="au-email" type="email" autoComplete="email" value=${f.email} onChange=${set('email')} required /><//>
      <${Field} label="Password"><input id="au-pass" type="password" autoComplete=${mode === 'in' ? 'current-password' : 'new-password'} value=${f.password} onChange=${set('password')} required minLength="6" /><//>
      ${msg && html`<div className=${'notice' + (msg.err ? ' warn' : '')} role="alert">${msg.text}</div>`}
      <button className="btn" type="submit" disabled=${busy}>${busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
      ${mode === 'in' && html`<button type="button" className="btn ghost" onClick=${forgot}>Forgot password?</button>`}
    </form>
    <p className="muted" style=${{ margin: 0 }}>${mode === 'in' ? 'New here? ' : 'Already have an account? '}
      <button className="btn ghost" style=${{ padding: 0 }} onClick=${() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }}>${mode === 'in' ? 'Create an account' : 'Sign in'}</button></p>
  <//>`;
}

function Onboarding({ profile }) {
  const [name, setName] = useState('Chazel Home');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const run = async (kind, fn) => { setBusy(kind); setErr(null); try { await fn(); } catch (e) { setErr(api.friendlyError(e)); setBusy(null); } };
  return html`<${AuthFrame}>
    <h1>Hi ${profile?.displayName?.split(' ')[0] || 'there'}</h1>
    <p className="muted" style=${{ margin: 0 }}>Start a new home, or join the one your partner already made.</p>
    ${err && html`<div className="notice warn" role="alert">${err}</div>`}
    <form className="card" onSubmit=${(e) => { e.preventDefault(); run('create', () => api.createHome(name)); }}>
      <span className="label">Start a new home</span>
      <${Field} label="Home name"><input id="ob-name" type="text" value=${name} onChange=${(e) => setName(e.target.value)} /><//>
      <button className="btn" type="submit" disabled=${!!busy}>${busy === 'create' ? 'Creating…' : 'Create home'}</button>
    </form>
    <form className="card" onSubmit=${(e) => { e.preventDefault(); run('join', () => api.joinHome(code)); }}>
      <span className="label">Join an existing home</span>
      <span className="muted small">Ask your partner for the 6-character code on their Household page.</span>
      <${Field} label="Invite code"><input id="ob-code" type="text" value=${code} maxLength="6" autoCapitalize="characters" autoComplete="off" placeholder="ABC234"
        style=${{ letterSpacing: '0.3em', fontSize: 20, fontWeight: 600, textTransform: 'uppercase' }} onChange=${(e) => setCode(e.target.value.toUpperCase())} /><//>
      <button className="btn secondary" type="submit" disabled=${!!busy || code.trim().length !== 6}>${busy === 'join' ? 'Joining…' : 'Join home'}</button>
    </form>
    <button className="btn ghost" onClick=${api.signOut}>Sign out</button>
  <//>`;
}

function App({ uid, home }) {
  const tab = useHash();
  const [db] = useState(() => api.homeStore(home.id));
  const [data, setData] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [people, setPeople] = useState({});
  const [sheet, setSheet] = useState(null);
  const [say, toastNode] = useToast();

  // Live data for the home's five shared lists.
  useEffect(() => {
    const unsubs = COLLECTIONS.map((c) => db.collection(c).onSnapshot((snap) => {
      setData((prev) => ({ ...prev, [c]: snap.docs.map((x) => ({ id: x.id, ...x.data() })) }));
      setLoaded(true);
    }, (err) => { setLoaded(true); say(api.friendlyError(err)); }));
    return () => unsubs.forEach((u) => u());
  }, [db]);

  // Everyone in the home: name and color, live.
  const memberIds = home.memberIds || [];
  const memberKey = memberIds.join(',');
  useEffect(() => {
    const unsubs = memberIds.map((id) => api.watchUser(id, (p) => setPeople((prev) => ({ ...prev, [id]: p })), () => {}));
    return () => unsubs.forEach((u) => u());
  }, [memberKey]);

  const profiles = useMemo(() => Object.fromEntries(Object.entries(people).filter(([, p]) => p).map(([id, p]) => [id, { name: p.displayName || '', color: p.color, avatarUrl: '' }])), [people]);
  const person = (id) => (id ? profiles[id] : null);
  const firstName = (id) => ((profiles[id]?.name || '').split(' ')[0] || 'Someone');
  const me = { id: uid };

  const write = async (fn, okMsg) => {
    try { await fn(db); if (okMsg) say(okMsg); return true; }
    catch (e) { say(api.friendlyError(e)); return false; }
  };

  // Live values are re-applied to an open sheet on every render, so it never shows stale data.
  const live = { data, members: memberIds, memberIds, profiles, person, firstName, home, people };
  const ctx = { db, me, write, say, setSheet, canWrite: true, ...live };
  const groceriesLeft = (data.shopping || []).filter((s) => !s.checked).length;
  const dueTodos = (data.todos || []).filter((t) => !t.done && t.dueDate && t.dueDate <= dayKey(new Date())).length;
  const View = { today: Today, calendar: Calendar, lists: Lists, menu: Menu, todos: Todos, household: Household }[tab];

  return html`
    <header className="top"><div className="wrap">
      <div className="toprow">
        <${Brand} sub=${home.name} />
        <span className="spacer"></span>
        <div className="faces">${memberIds.slice(0, 5).map((id) => html`<span key=${id} title=${profiles[id]?.name || ''} className="face"><${Avatar} p=${profiles[id]} /></span>`)}</div>
      </div>
      <nav className="tabs" aria-label="Sections">
        ${TABS.map((t) => html`<a key=${t.id} href=${'#' + t.id} aria-current=${tab === t.id ? 'page' : undefined}>${t.label}
          ${t.id === 'lists' && groceriesLeft > 0 && html`<span className="count num">${groceriesLeft}</span>`}
          ${t.id === 'todos' && dueTodos > 0 && html`<span className="count num">${dueTodos}</span>`}</a>`)}
      </nav>
    </div></header>
    <main className="wrap">${loaded ? html`<${View} ...${ctx} />` : html`<div className="skeleton"></div><div className="skeleton"></div>`}</main>
    ${sheet && React.cloneElement(sheet, live)}
    ${toastNode}`;
}

/** Put a recipe's ingredients on Groceries, combining with unchecked items already there. */
async function addToGroceries(db, recipe, shopping, uid) {
  const { updates, additions } = planGroceries(recipe.ingredients, shopping);
  for (const u of updates) await db.doc(`shopping/${u.id}`).update({ quantity: u.quantity });
  let n = 0;
  for (const a of additions) {
    await db.collection('shopping').add({ ...a, category: 'groceries', checked: false, addedBy: uid || null, recipeName: recipe.name, createdAt: Date.now() + n++ });
  }
  return updates.length + additions.length;
}

// ---------- Today ----------
function Today(ctx) {
  const { data, me, firstName, profiles, person, setSheet } = ctx;
  const now = new Date(); const tk = dayKey(now);
  const events = data.events || [];
  const upcoming = events.filter((e) => (e.end || e.start) >= startOfDay(now).getTime() && e.start < addDays(startOfDay(now), 7).getTime()).sort((a, b) => a.start - b.start);
  const todays = upcoming.filter((e) => eventDays(e).includes(tk));
  const later = upcoming.filter((e) => !eventDays(e).includes(tk));
  const remindNow = upcoming.filter((e) => e.reminderMinutes != null && !e.allDay && e.start > now && e.start - e.reminderMinutes * 60000 <= now);
  const meals = (data.menu || []).filter((m) => m.date === tk).sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
  const mine = (data.todos || []).filter((t) => !t.done && (t.assigneeId === me?.id || !t.assigneeId) && (!t.dueDate || t.dueDate <= tk))
    .sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9'));
  const counts = CATS.map((c) => ({ ...c, n: (data.shopping || []).filter((s) => s.category === c.key && !s.checked).length }));
  const greet = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const name = (profiles[me?.id]?.name || '').split(' ')[0];

  return html`
    <div className="stack" style=${{ gap: 4 }}>
      <span className="muted">${fmtDay(now)}</span>
      <h1>${greet}${name ? `, ${name}` : ''}</h1>
    </div>
    ${remindNow.map((e) => html`<div key=${e.id} className="notice"><strong>Coming up:</strong> ${e.title} at ${fmtTime(e.start)}</div>`)}
    <div className="grid2">
      <section className="card">
        <div className="between"><span className="label">Today</span><button className="btn ghost sm" onClick=${() => setSheet(html`<${EventSheet} ...${ctx} date=${tk} />`)}>+ Event</button></div>
        ${todays.length === 0 ? html`<span className="muted">Nothing on the calendar today.</span>` : todays.map((e) => html`
          <button key=${e.id} className="row" style=${{ border: 0, background: 'none', padding: 0, textAlign: 'left' }} onClick=${() => setSheet(html`<${EventSheet} ...${ctx} event=${e} />`)}>
            <span className="time">${e.allDay ? 'All day' : fmtTime(e.start)}</span><span className="grow">${e.title}</span>
          </button>`)}
        ${later.length > 0 && html`<span className="label" style=${{ marginTop: 6 }}>This week</span>
          ${later.slice(0, 4).map((e) => html`<div key=${e.id} className="row small"><span className="time">${new Date(e.start).toLocaleDateString([], { weekday: 'short' })}</span><span className="grow">${e.title}</span></div>`)}`}
      </section>
      <section className="card">
        <div className="between"><span className="label">On the menu</span><button className="btn ghost sm" onClick=${() => setSheet(html`<${MenuAddSheet} ...${ctx} date=${tk} />`)}>+ Meal</button></div>
        ${meals.length === 0 ? html`<span className="muted">No meals planned for today.</span>` : meals.map((m) => html`
          <div key=${m.id} className="row"><span className="meal">${m.meal}</span><span className="grow">${m.title}</span></div>`)}
      </section>
    </div>
    <section className="card">
      <div className="between"><span className="label">Your to-dos</span><a className="btn ghost sm" href="#todos">All to-dos</a></div>
      ${mine.length === 0 ? html`<span className="muted">You're all caught up.</span>` : mine.slice(0, 6).map((t) => html`<${TodoRow} key=${t.id} t=${t} ...${ctx} />`)}
    </section>
    <a href="#lists" className="card" style=${{ textDecoration: 'none', color: 'inherit' }}>
      <span className="label">Shopping</span>
      <div className="chips">${counts.map((c) => html`<span key=${c.key} className="pill num">${c.label}: ${c.n}</span>`)}</div>
    </a>`;
}

// ---------- Calendar ----------
function Calendar(ctx) {
  const { data, person, setSheet } = ctx;
  const [sel, setSel] = useState(startOfDay(new Date()));
  const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const byDay = useMemo(() => {
    const m = new Map();
    for (const e of data.events || []) for (const k of eventDays(e)) m.set(k, [...(m.get(k) || []), e]);
    return m;
  }, [data.events]);
  const gridStart = startOfWeek(month);
  const weeks = Math.ceil((new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() + month.getDay()) / 7);
  const tk = dayKey(new Date());
  const dayEvents = (byDay.get(dayKey(sel)) || []).slice().sort((a, b) => (b.allDay - a.allDay) || a.start - b.start);

  return html`
    <div className="between"><h1>Calendar</h1><button className="btn" onClick=${() => setSheet(html`<${EventSheet} ...${ctx} date=${dayKey(sel)} />`)}>+ New event</button></div>
    <section className="card">
      <div className="between">
        <button className="iconbtn" aria-label="Previous month" onClick=${() => setMonth(addMonths(month, -1))}>‹</button>
        <h2>${month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h2>
        <button className="iconbtn" aria-label="Next month" onClick=${() => setMonth(addMonths(month, 1))}>›</button>
      </div>
      <div className="month">
        ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => html`<div key=${'h' + i} className="dow">${d}</div>`)}
        ${Array.from({ length: weeks * 7 }, (_, i) => {
          const d = addDays(gridStart, i); const k = dayKey(d); const n = (byDay.get(k) || []).length;
          const cls = [d.getMonth() !== month.getMonth() && 'out', k === tk && 'today'].filter(Boolean).join(' ');
          return html`<button key=${k} className=${cls} aria-pressed=${k === dayKey(sel) ? 'true' : 'false'} aria-label=${fmtDay(d) + (n ? `, ${n} events` : '')}
            onClick=${() => { setSel(d); if (d.getMonth() !== month.getMonth()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>
            <span>${d.getDate()}</span><span className="dots">${Array.from({ length: Math.min(n, 3) }, (_, j) => html`<i key=${j}></i>`)}</span></button>`;
        })}
      </div>
    </section>
    <span className="label">${fmtDay(sel)}</span>
    ${dayEvents.length === 0 ? html`<div className="list"><${Empty} title="Nothing planned">Add an event for this day with “New event”.<//></div>` : html`
      <div className="list">${dayEvents.map((e) => {
        const p = person(e.createdBy);
        return html`<button key=${e.id} className="item row rowbtn" onClick=${() => setSheet(html`<${EventSheet} ...${ctx} event=${e} />`)}>
          <span className="stripe" style=${{ background: p?.color || 'var(--accent)' }}></span>
          <span className="grow stack" style=${{ gap: 2 }}>
            <strong>${e.title}</strong>
            <span className="muted small">${e.allDay ? 'All day' : `${fmtTime(e.start)} – ${fmtTime(e.end)}`}${e.reminderMinutes != null ? ` · ${reminderLabel(e.reminderMinutes)}` : ''}</span>
          </span>
          ${p && html`<${Avatar} p=${p} />`}
        </button>`;
      })}</div>`}`;
}

function EventSheet(ctx) {
  const { event, date, write, setSheet, me, say } = ctx;
  const base = event ? new Date(event.start) : (() => { const d = parseKey(date || dayKey(new Date())); const n = new Date(); d.setHours(n.getHours() + 1, 0, 0, 0); return d; })();
  const baseEnd = event ? new Date(event.end) : new Date(base.getTime() + 3600000);
  const [f, setF] = useState({
    title: event?.title || '', allDay: !!event?.allDay, notes: event?.notes || '',
    day: dayKey(base), start: timeStr(base), endDay: dayKey(baseEnd), end: timeStr(baseEnd),
    reminder: event ? (event.reminderMinutes ?? null) : 30,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const close = () => setSheet(null);

  const save = async () => {
    if (!f.title.trim()) return say('Give the event a title.');
    const at = (day, t) => { const d = parseKey(day); const [h, m] = t.split(':').map(Number); d.setHours(h, m, 0, 0); return d.getTime(); };
    const start = f.allDay ? parseKey(f.day).getTime() : at(f.day, f.start);
    const end = f.allDay ? parseKey(f.endDay).getTime() + 86340000 : at(f.endDay, f.end);
    if (end < start) return say('The event ends before it starts.');
    const body = { title: f.title.trim(), start, end, allDay: f.allDay, notes: f.notes.trim(), reminderMinutes: f.reminder === '' || f.reminder === null ? null : Number(f.reminder), createdBy: event?.createdBy || me?.id || null };
    if (await write((db) => event ? db.doc(`events/${event.id}`).set(body) : db.collection('events').add(body), event ? 'Event updated' : 'Event added')) close();
  };

  return html`<${Sheet} title=${event ? 'Edit event' : 'New event'} onClose=${close}>
    <${Field} label="Title"><input id="ev-title" type="text" value=${f.title} onChange=${set('title')} placeholder="Dinner with friends" autoFocus /><//>
    <label className="row"><input id="ev-allday" type="checkbox" checked=${f.allDay} onChange=${set('allDay')} /> All day</label>
    <div className="fields2">
      <${Field} label="Starts"><input id="ev-day" type="date" value=${f.day} onChange=${(e) => setF({ ...f, day: e.target.value, endDay: e.target.value > f.endDay ? e.target.value : f.endDay })} /><//>
      ${!f.allDay && html`<${Field} label="Start time"><input id="ev-start" type="time" value=${f.start} onChange=${set('start')} /><//>`}
      <${Field} label="Ends"><input id="ev-endday" type="date" value=${f.endDay} onChange=${set('endDay')} /><//>
      ${!f.allDay && html`<${Field} label="End time"><input id="ev-end" type="time" value=${f.end} onChange=${set('end')} /><//>`}
    </div>
    <${Field} label="Reminder"><select id="ev-reminder" value=${f.reminder === null ? '' : String(f.reminder)} onChange=${(e) => setF({ ...f, reminder: e.target.value === '' ? null : Number(e.target.value) })}>
      ${REMINDERS.map((m) => html`<option key=${String(m)} value=${m === null ? '' : String(m)}>${reminderLabel(m)}</option>`)}
    </select><//>
    <${Field} label="Notes"><textarea id="ev-notes" value=${f.notes} onChange=${set('notes')} placeholder="Address, what to bring…"></textarea><//>
    <button className="btn" onClick=${save}>${event ? 'Save changes' : 'Add event'}</button>
    ${event && html`
      <div className="notice small">Want a phone alert? <a href=${googleCalLink(event)} target="_blank" rel="noopener">Add it to Google Calendar</a> and its app will notify you. HomeIQ also shows a “Coming up” note on the Today page when the reminder time arrives.</div>
      <${ConfirmDelete} label="Delete event" onConfirm=${async () => { if (await write((db) => db.doc(`events/${event.id}`).delete(), 'Event deleted')) close(); }} />`}
  <//>`;
}

// ---------- Lists ----------
function Lists(ctx) {
  const { data, write, person, me } = ctx;
  const [cat, setCat] = useState(() => { try { return localStorage.getItem('homeiq-cat') || 'groceries'; } catch { return 'groceries'; } });
  const [name, setName] = useState(''); const [qty, setQty] = useState('');
  const [openId, setOpenId] = useState(null);
  useEffect(() => { try { localStorage.setItem('homeiq-cat', cat); } catch {} }, [cat]);
  const items = (data.shopping || []).filter((s) => s.category === cat).sort((a, b) => a.createdAt - b.createdAt);
  const open = items.filter((i) => !i.checked); const done = items.filter((i) => i.checked);

  const add = async (e) => {
    e.preventDefault(); if (!name.trim()) return;
    const body = { name: name.trim(), quantity: qty.trim(), category: cat, checked: false, addedBy: me?.id || null, recipeName: null, createdAt: Date.now() };
    setName(''); setQty('');
    await write((db) => db.collection('shopping').add(body));
  };
  const toggle = (i) => write((db) => db.doc(`shopping/${i.id}`).update({ checked: !i.checked }));
  const clear = () => write(async (db) => { for (const i of done) await db.doc(`shopping/${i.id}`).delete(); }, `Cleared ${done.length} items`);

  const Item = ({ i }) => {
    const p = person(i.addedBy);
    return html`<div className="item">
      <div className="row">
        <input type="checkbox" className="check" style=${{ '--c': `var(--${i.category})` }} checked=${!!i.checked} onChange=${() => toggle(i)} aria-label=${'Got ' + i.name} />
        <button className="grow" style=${{ border: 0, background: 'none', textAlign: 'left', padding: 0 }} onClick=${() => setOpenId(openId === i.id ? null : i.id)}>
          <span className=${i.checked ? 'done-text' : ''}>${i.name}</span>${i.quantity && html` <span className="qty">· ${i.quantity}</span>`}
          ${i.recipeName && !i.checked && html`<div className="muted small">for ${i.recipeName}</div>`}
        </button>
        ${p && html`<${Avatar} p=${p} />`}
      </div>
      ${openId === i.id && html`<div className="tray">
        ${CATS.filter((c) => c.key !== i.category).map((c) => html`<button key=${c.key} className="btn sm secondary" onClick=${() => write((db) => db.doc(`shopping/${i.id}`).update({ category: c.key }), `Moved to ${c.label}`)}>Move to ${c.label}</button>`)}
        <button className="btn sm danger" onClick=${() => write((db) => db.doc(`shopping/${i.id}`).delete())}>Remove</button>
      </div>`}
    </div>`;
  };

  return html`
    <h1>Lists</h1>
    <div className="chips">${CATS.map((c) => {
      const n = (data.shopping || []).filter((s) => s.category === c.key && !s.checked).length;
      return html`<${Chip} key=${c.key} className=${'cat ' + c.key} on=${cat === c.key} onClick=${() => setCat(c.key)}>${c.label}${n ? html` <span className="num">${n}</span>` : ''}<//>`;
    })}</div>
    <form className="addbar" onSubmit=${add}>
      <input id="list-name" type="text" value=${name} onChange=${(e) => setName(e.target.value)} placeholder=${`Add to ${CATS.find((c) => c.key === cat).label.toLowerCase()}…`} aria-label="Item" />
      <input id="list-qty" type="text" value=${qty} onChange=${(e) => setQty(e.target.value)} placeholder="Qty" aria-label="Quantity" />
      <button className="btn" type="submit">Add</button>
    </form>
    ${items.length === 0 ? html`<div className="list"><${Empty} title="This list is empty">${cat === 'groceries' ? 'Add items above, or put a recipe on the menu to fill it automatically.' : 'Add the first item above.'}<//></div>` : html`
      ${open.length > 0 && html`<div className="list">${open.map((i) => html`<${Item} key=${i.id} i=${i} />`)}</div>`}
      ${done.length > 0 && html`
        <div className="between"><span className="label">In the cart · ${done.length}</span><button className="btn ghost sm" onClick=${clear}>Clear checked</button></div>
        <div className="list">${done.map((i) => html`<${Item} key=${i.id} i=${i} />`)}</div>`}`}`;
}

// ---------- Menu ----------
function Menu(ctx) {
  const { data, write, setSheet, say, me } = ctx;
  const [view, setView] = useState('plan');
  const [week, setWeek] = useState(startOfWeek(new Date()));
  const recipes = (data.recipes || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const keys = days.map(dayKey);
  const entries = (data.menu || []).filter((m) => keys.includes(m.date));
  const tk = dayKey(new Date());

  const shopWeek = () => {
    const planned = entries.map((m) => recipes.find((r) => r.id === m.recipeId)).filter(Boolean);
    if (planned.length === 0) return say('No saved recipes on the menu this week.');
    // One combined pass, so an ingredient shared by two recipes becomes one line.
    const combined = { name: "this week's menu", ingredients: planned.flatMap((r) => r.ingredients || []) };
    write(async (db) => {
      const n = await addToGroceries(db, combined, data.shopping, me?.id);
      say(`${n} ingredients from ${planned.length} meals added to Groceries`);
    });
  };

  return html`
    <div className="between"><h1>Menu</h1>
      ${view === 'plan' ? html`<button className="btn" onClick=${() => setSheet(html`<${MenuAddSheet} ...${ctx} />`)}>+ Add meal</button>`
        : html`<button className="btn" onClick=${() => setSheet(html`<${RecipeEditSheet} ...${ctx} />`)}>+ New recipe</button>`}</div>
    <div className="chips">
      <${Chip} on=${view === 'plan'} onClick=${() => setView('plan')}>Weekly plan<//>
      <${Chip} on=${view === 'recipes'} onClick=${() => setView('recipes')}>Recipes · <span className="num">${recipes.length}</span><//>
    </div>
    ${view === 'plan' ? html`
      <div className="between">
        <button className="iconbtn" aria-label="Previous week" onClick=${() => setWeek(addDays(week, -7))}>‹</button>
        <strong>${week.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${addDays(week, 6).toLocaleDateString([], { month: 'short', day: 'numeric' })}</strong>
        <button className="iconbtn" aria-label="Next week" onClick=${() => setWeek(addDays(week, 7))}>›</button>
      </div>
      ${days.map((d) => {
        const k = dayKey(d);
        const list = entries.filter((m) => m.date === k).sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
        return html`<section key=${k} className=${'card day' + (k === tk ? ' today' : '')}>
          <div className="between"><strong>${d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</strong>
            <button className="btn ghost sm" onClick=${() => setSheet(html`<${MenuAddSheet} ...${ctx} date=${k} />`)}>+ Add</button></div>
          ${list.length === 0 ? html`<span className="muted small">Nothing planned</span>` : list.map((m) => html`
            <div key=${m.id} className="row">
              <span className="meal">${m.meal}</span>
              ${m.recipeId && recipes.some((r) => r.id === m.recipeId)
                ? html`<button className="grow" style=${{ border: 0, background: 'none', padding: 0, textAlign: 'left', color: 'var(--accent)', fontWeight: 600 }} onClick=${() => setSheet(html`<${RecipeSheet} ...${ctx} id=${m.recipeId} />`)}>${m.title}</button>`
                : html`<span className="grow">${m.title}</span>`}
              <button className="iconbtn" aria-label=${'Remove ' + m.title} onClick=${() => write((db) => db.doc(`menu/${m.id}`).delete(), 'Removed from menu')}>✕</button>
            </div>`)}
        </section>`;
      })}
      <button className="btn secondary" onClick=${shopWeek}>Add this week's ingredients to Groceries</button>`
    : recipes.length === 0 ? html`<div className="list"><${Empty} title="No recipes yet">Save your go-to meals. Putting one on the menu adds its ingredients to Groceries.<//></div>`
    : html`<div className="list">${recipes.map((r) => html`
        <button key=${r.id} className="item row rowbtn" onClick=${() => setSheet(html`<${RecipeSheet} ...${ctx} id=${r.id} />`)}>
          <span className="grow"><strong>${r.name}</strong><div className="muted small">${(r.ingredients || []).length} ingredients${r.servings ? ` · serves ${r.servings}` : ''}</div></span><span className="muted">›</span>
        </button>`)}</div>`}`;
}

function MenuAddSheet(ctx) {
  const { data, write, setSheet, say, me, date, recipeId } = ctx;
  const recipes = (data.recipes || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const [f, setF] = useState({ date: date || dayKey(new Date()), meal: 'dinner', recipeId: recipeId || null, title: '', groceries: true });
  const recipe = recipes.find((r) => r.id === f.recipeId);
  const close = () => setSheet(null);
  const save = async () => {
    if (!recipe && !f.title.trim()) return say('Pick a recipe or type what you’re having.');
    const ok = await write(async (db) => {
      await db.collection('menu').add({ date: f.date, meal: f.meal, title: recipe ? recipe.name : f.title.trim(), recipeId: recipe?.id || null });
      if (recipe && f.groceries) { const n = await addToGroceries(db, recipe, data.shopping, me?.id); say(`Added to menu, and ${n} ingredients to Groceries`); }
      else say('Added to menu');
    });
    if (ok) close();
  };
  return html`<${Sheet} title="Add to menu" onClose=${close}>
    <${Field} label="Day"><input id="ma-date" type="date" value=${f.date} onChange=${(e) => setF({ ...f, date: e.target.value })} /><//>
    <div className="chips">${MEALS.map((m) => html`<${Chip} key=${m} on=${f.meal === m} onClick=${() => setF({ ...f, meal: m })}>${m[0].toUpperCase() + m.slice(1)}<//>`)}</div>
    <span className="label">From your recipes</span>
    ${recipes.length === 0 ? html`<span className="muted small">No saved recipes yet. Type a meal below, or save recipes under Menu → Recipes.</span>`
      : html`<div className="chips">${recipes.map((r) => html`<${Chip} key=${r.id} on=${f.recipeId === r.id} onClick=${() => setF({ ...f, recipeId: f.recipeId === r.id ? null : r.id })}>${r.name}<//>`)}</div>`}
    ${!recipe && html`<${Field} label="Or something quick"><input id="ma-title" type="text" value=${f.title} onChange=${(e) => setF({ ...f, title: e.target.value })} placeholder="Leftovers, takeout, tacos…" /><//>`}
    ${recipe && html`<label className="row card"><input id="ma-groc" type="checkbox" checked=${f.groceries} onChange=${(e) => setF({ ...f, groceries: e.target.checked })} />
      <span className="grow">Add its ${(recipe.ingredients || []).length} ingredients to Groceries</span></label>`}
    <button className="btn" onClick=${save}>Add to menu</button>
  <//>`;
}

function RecipeSheet(ctx) {
  const { data, write, setSheet, say, me, id } = ctx;
  const r = (data.recipes || []).find((x) => x.id === id);
  const close = () => setSheet(null);
  if (!r) return html`<${Sheet} title="Recipe" onClose=${close}><span className="muted">This recipe was deleted.</span><//>`;
  return html`<${Sheet} title=${r.name} onClose=${close}>
    ${(r.servings || r.sourceUrl) && html`<div className="muted small">${r.servings ? `Serves ${r.servings}` : ''}${r.servings && r.sourceUrl ? ' · ' : ''}${r.sourceUrl && html`<a href=${r.sourceUrl} target="_blank" rel="noopener">Original recipe</a>`}</div>`}
    <div className="fields2">
      <button className="btn" onClick=${() => setSheet(html`<${MenuAddSheet} ...${ctx} recipeId=${r.id} />`)}>Add to menu</button>
      <button className="btn secondary" onClick=${() => write(async (db) => { const n = await addToGroceries(db, r, data.shopping, me?.id); say(`${n} ingredients added to Groceries`); })}>Add to Groceries</button>
    </div>
    <span className="label">Ingredients</span>
    <div className="list">${(r.ingredients || []).length === 0 ? html`<div className="item muted">No ingredients listed.</div>` : r.ingredients.map((g, i) => html`
      <div key=${i} className="item between"><span>${g.name}</span><span className="muted">${g.quantity}</span></div>`)}</div>
    ${r.instructions && html`<span className="label">Instructions</span><div className="card" style=${{ whiteSpace: 'pre-wrap' }}>${r.instructions}</div>`}
    <button className="btn ghost" onClick=${() => setSheet(html`<${RecipeEditSheet} ...${ctx} recipe=${r} />`)}>Edit recipe</button>
    <${ConfirmDelete} label="Delete recipe" onConfirm=${async () => { if (await write((db) => db.doc(`recipes/${r.id}`).delete(), 'Recipe deleted')) close(); }} />
  <//>`;
}

function RecipeEditSheet(ctx) {
  const { write, setSheet, say, me, recipe } = ctx;
  const [f, setF] = useState({ name: recipe?.name || '', servings: recipe?.servings || '', sourceUrl: recipe?.sourceUrl || '', instructions: recipe?.instructions || '' });
  const [ings, setIngs] = useState(recipe?.ingredients?.length ? recipe.ingredients : [{ name: '', quantity: '' }]);
  const [paste, setPaste] = useState(null);
  const close = () => setSheet(null);
  const setIng = (i, patch) => setIngs(ings.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const save = async () => {
    if (!f.name.trim()) return say('Give the recipe a name.');
    const body = { name: f.name.trim(), servings: f.servings.trim(), sourceUrl: f.sourceUrl.trim(), instructions: f.instructions.trim(),
      ingredients: ings.filter((g) => g.name.trim()).map((g) => ({ name: g.name.trim(), quantity: (g.quantity || '').trim() })), createdBy: recipe?.createdBy || me?.id || null };
    let newId = recipe?.id;
    const ok = await write(async (db) => { if (recipe) await db.doc(`recipes/${recipe.id}`).set(body); else newId = (await db.collection('recipes').add(body)).id; }, 'Recipe saved');
    if (ok) setSheet(html`<${RecipeSheet} ...${ctx} id=${newId} />`);
  };
  return html`<${Sheet} title=${recipe ? 'Edit recipe' : 'New recipe'} onClose=${close}>
    <${Field} label="Name"><input id="rc-name" type="text" value=${f.name} onChange=${(e) => setF({ ...f, name: e.target.value })} placeholder="Sheet-pan chicken" /><//>
    <div className="fields2">
      <${Field} label="Serves"><input id="rc-serves" type="text" value=${f.servings} onChange=${(e) => setF({ ...f, servings: e.target.value })} placeholder="4" /><//>
      <${Field} label="Link (optional)"><input id="rc-url" type="text" value=${f.sourceUrl} onChange=${(e) => setF({ ...f, sourceUrl: e.target.value })} placeholder="https://…" /><//>
    </div>
    <div className="between"><span className="label">Ingredients</span>${paste === null && html`<button className="btn ghost sm" onClick=${() => setPaste('')}>Paste a list</button>`}</div>
    ${paste !== null && html`<div className="stack">
      <textarea id="rc-paste" value=${paste} onChange=${(e) => setPaste(e.target.value)} placeholder=${'One per line, e.g.\n2 cups rice\n1 lb chicken thighs\n3 cloves garlic'}></textarea>
      <div className="row"><button className="btn ghost sm" onClick=${() => setPaste(null)}>Cancel</button>
        <button className="btn sm" onClick=${() => { setIngs([...ings.filter((g) => g.name.trim()), ...parseIngredients(paste)]); setPaste(null); }}>Add these lines</button></div>
    </div>`}
    ${ings.map((g, i) => html`<div key=${i} className="ingrow">
      <input type="text" value=${g.quantity} onChange=${(e) => setIng(i, { quantity: e.target.value })} placeholder="Qty" aria-label="Quantity" />
      <input type="text" value=${g.name} onChange=${(e) => setIng(i, { name: e.target.value })} placeholder="Ingredient" aria-label="Ingredient" />
      <button className="iconbtn" aria-label="Remove ingredient" onClick=${() => setIngs(ings.filter((_, j) => j !== i))}>✕</button>
    </div>`)}
    <button className="btn sm secondary" onClick=${() => setIngs([...ings, { name: '', quantity: '' }])}>+ Ingredient</button>
    <${Field} label="Instructions"><textarea id="rc-steps" value=${f.instructions} onChange=${(e) => setF({ ...f, instructions: e.target.value })} placeholder="Steps, oven temperature, notes…"></textarea><//>
    <button className="btn" onClick=${save}>Save recipe</button>
  <//>`;
}

// ---------- To-dos ----------
function TodoRow(ctx) {
  const { t, person, write, setSheet, me } = ctx;
  const p = person(t.assigneeId); const tk = dayKey(new Date());
  const toggle = () => {
    if (!t.done && t.recurrence && t.recurrence !== 'none') {
      const next = nextDue(t.dueDate, t.recurrence);
      return write((db) => db.doc(`todos/${t.id}`).update({ dueDate: next, completedAt: Date.now(), completedBy: me?.id || null }), `Done. Next due: ${dueLabel(next)}`);
    }
    return write((db) => db.doc(`todos/${t.id}`).update({ done: !t.done, completedAt: t.done ? null : Date.now(), completedBy: t.done ? null : (me?.id || null) }));
  };
  return html`<div className="row">
    <input type="checkbox" className="check" style=${{ '--c': p?.color || 'var(--accent)' }} checked=${!!t.done} onChange=${toggle} aria-label=${'Done: ' + t.title} />
    <button className="grow" style=${{ border: 0, background: 'none', padding: '4px 0', textAlign: 'left' }} onClick=${() => setSheet(html`<${TodoSheet} ...${ctx} todo=${t} />`)}>
      <span className=${t.done ? 'done-text' : ''}>${t.title}</span>
      <span className="chips" style=${{ marginTop: 2 }}>
        ${t.dueDate && !t.done && html`<span className=${'pill' + (t.dueDate < tk ? ' warn' : '')}>${dueLabel(t.dueDate)}</span>`}
        ${t.recurrence && t.recurrence !== 'none' && html`<span className="pill accent">↻ ${REPEATS.find((r) => r.key === t.recurrence)?.label}</span>`}
      </span>
    </button>
    ${p ? html`<${Avatar} p=${p} />` : html`<span className="muted small">Anyone</span>`}
  </div>`;
}

function Todos(ctx) {
  const { data, me, memberIds, firstName, profiles, setSheet } = ctx;
  const [filter, setFilter] = useState('all');
  const [showDone, setShowDone] = useState(false);
  const tk = dayKey(new Date());
  const match = (t) => filter === 'all' || (filter === 'anyone' ? !t.assigneeId : t.assigneeId === filter);
  const vis = (data.todos || []).filter(match);
  const open = vis.filter((t) => !t.done).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.createdAt - b.createdAt);
  const groups = [
    ['Overdue', open.filter((t) => t.dueDate && t.dueDate < tk)],
    ['Today', open.filter((t) => t.dueDate === tk)],
    ['Upcoming', open.filter((t) => t.dueDate && t.dueDate > tk)],
    ['Anytime', open.filter((t) => !t.dueDate)],
  ].filter(([, l]) => l.length);
  const done = vis.filter((t) => t.done).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  return html`
    <div className="between"><h1>To-Do</h1><button className="btn" onClick=${() => setSheet(html`<${TodoSheet} ...${ctx} />`)}>+ New to-do</button></div>
    <div className="chips">
      <${Chip} on=${filter === 'all'} onClick=${() => setFilter('all')}>Everyone<//>
      ${memberIds.map((id) => html`<${Chip} key=${id} on=${filter === id} color=${profiles[id]?.color} onClick=${() => setFilter(id)}>${id === me?.id ? 'Mine' : firstName(id)}<//>`)}
      <${Chip} on=${filter === 'anyone'} onClick=${() => setFilter('anyone')}>Unassigned<//>
    </div>
    ${open.length === 0 && html`<div className="list"><${Empty} title="Nothing to do">Add a task with “New to-do”. Set it to repeat for chores like trash day.<//></div>`}
    ${groups.map(([title, list]) => html`<section key=${title} className="stack" style=${{ gap: 6 }}>
      <span className="label">${title} · <span className="num">${list.length}</span></span>
      <div className="list">${list.map((t) => html`<div key=${t.id} className="item"><${TodoRow} ...${ctx} t=${t} /></div>`)}</div>
    </section>`)}
    ${done.length > 0 && html`
      <button className="btn ghost" style=${{ alignSelf: 'flex-start' }} onClick=${() => setShowDone(!showDone)}>${showDone ? 'Hide' : 'Show'} completed (${done.length})</button>
      ${showDone && html`<div className="list">${done.slice(0, 40).map((t) => html`<div key=${t.id} className="item"><${TodoRow} ...${ctx} t=${t} /></div>`)}</div>`}`}`;
}

function TodoSheet(ctx) {
  const { todo, write, setSheet, say, me, memberIds, profiles, firstName, person } = ctx;
  const [f, setF] = useState({
    title: todo?.title || '', notes: todo?.notes || '', assigneeId: todo?.assigneeId ?? null,
    hasDue: !!todo?.dueDate, due: todo?.dueDate || dayKey(new Date()), recurrence: todo?.recurrence || 'none',
  });
  const close = () => setSheet(null);
  const save = async () => {
    if (!f.title.trim()) return say('What needs doing?');
    const hasDue = f.hasDue || f.recurrence !== 'none';
    const body = { title: f.title.trim(), notes: f.notes.trim(), assigneeId: f.assigneeId, dueDate: hasDue ? f.due : null, recurrence: f.recurrence };
    const ok = await write((db) => todo ? db.doc(`todos/${todo.id}`).update(body)
      : db.collection('todos').add({ ...body, done: false, completedAt: null, completedBy: null, createdBy: me?.id || null, createdAt: Date.now() }), todo ? 'To-do updated' : 'To-do added');
    if (ok) close();
  };
  const by = todo?.completedBy && person(todo.completedBy);
  return html`<${Sheet} title=${todo ? 'Edit to-do' : 'New to-do'} onClose=${close}>
    <${Field} label="Task"><input id="td-title" type="text" value=${f.title} onChange=${(e) => setF({ ...f, title: e.target.value })} placeholder="Take out the recycling" /><//>
    <span className="label">Assign to</span>
    <div className="chips">
      <${Chip} on=${f.assigneeId === null} onClick=${() => setF({ ...f, assigneeId: null })}>Anyone<//>
      ${memberIds.map((id) => html`<${Chip} key=${id} on=${f.assigneeId === id} color=${profiles[id]?.color} onClick=${() => setF({ ...f, assigneeId: id })}>${firstName(id)}${id === me?.id ? ' (me)' : ''}<//>`)}
    </div>
    <span className="label">Repeat</span>
    <div className="chips">${REPEATS.map((r) => html`<${Chip} key=${r.key} on=${f.recurrence === r.key} onClick=${() => setF({ ...f, recurrence: r.key, hasDue: r.key !== 'none' ? true : f.hasDue })}>${r.label}<//>`)}</div>
    <label className="row"><input id="td-hasdue" type="checkbox" checked=${f.hasDue || f.recurrence !== 'none'} disabled=${f.recurrence !== 'none'} onChange=${(e) => setF({ ...f, hasDue: e.target.checked })} /> Has a due date</label>
    ${(f.hasDue || f.recurrence !== 'none') && html`<${Field} label=${f.recurrence === 'none' ? 'Due' : 'Next due'}><input id="td-due" type="date" value=${f.due} onChange=${(e) => setF({ ...f, due: e.target.value })} /><//>`}
    ${f.recurrence !== 'none' && html`<span className="muted small">Checking it off moves it to the next due date automatically.</span>`}
    <${Field} label="Notes"><textarea id="td-notes" value=${f.notes} onChange=${(e) => setF({ ...f, notes: e.target.value })} placeholder="Details…"></textarea><//>
    ${by && html`<div className="row small muted"><${Avatar} p=${by} /> Last done by ${firstName(todo.completedBy)} on ${fmtShort(new Date(todo.completedAt))}</div>`}
    <button className="btn" onClick=${save}>${todo ? 'Save changes' : 'Add to-do'}</button>
    ${todo && html`<${ConfirmDelete} label="Delete to-do" onConfirm=${async () => { if (await write((db) => db.doc(`todos/${todo.id}`).delete(), 'To-do deleted')) close(); }} />`}
  <//>`;
}

// ---------- Household ----------
function Household(ctx) {
  const { home, memberIds, profiles, me, people, say } = ctx;
  const [name, setName] = useState(home.name);
  const mine = people[me.id];
  const [myName, setMyName] = useState(mine?.displayName || '');
  const [leaving, setLeaving] = useState(false);
  useEffect(() => setName(home.name), [home.name]);
  useEffect(() => setMyName(mine?.displayName || ''), [mine?.displayName]);
  const link = location.origin + location.pathname;

  const copy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); say(`${label} copied`); }
    catch { say(`Select and copy: ${text}`); }
  };
  const share = async () => {
    const text = `Join our home "${home.name}" on HomeIQ: open ${link}, create an account, choose “Join an existing home” and enter code ${home.inviteCode}`;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
    copy(text, 'Invite');
  };
  const act = async (fn, ok) => { try { await fn(); if (ok) say(ok); } catch (e) { say(api.friendlyError(e)); } };

  return html`
    <h1>Household</h1>
    <section className="card" style=${{ alignItems: 'flex-start' }}>
      <span className="label">Invite someone</span>
      <span>They open this site, create their own account, choose <strong>Join an existing home</strong> and enter:</span>
      <span className="code num">${home.inviteCode}</span>
      <div className="row" style=${{ flexWrap: 'wrap' }}>
        <button className="btn" onClick=${share}>Send invite</button>
        <button className="btn secondary" onClick=${() => copy(home.inviteCode, 'Code')}>Copy code</button>
      </div>
    </section>
    <section className="card">
      <span className="label">Who's in ${home.name}</span>
      ${memberIds.map((id) => html`<div key=${id} className="row">
        <${Avatar} p=${profiles[id]} lg />
        <span className="grow"><strong>${profiles[id]?.name || 'Someone'}</strong>${id === me.id ? html` <span className="muted">(you)</span>` : ''}
          <div className="muted small">${people[id]?.email || ''}${id === home.ownerId ? ' · started this home' : ''}</div></span>
      </div>`)}
    </section>
    <form className="card" onSubmit=${(e) => { e.preventDefault(); if (name.trim() && name !== home.name) act(() => api.renameHome(home.id, name), 'Home renamed'); }}>
      <span className="label">Home name</span>
      <div className="row"><input id="hh-name" type="text" className="grow" value=${name} onChange=${(e) => setName(e.target.value)} /><button className="btn" type="submit">Save</button></div>
    </form>
    <form className="card" onSubmit=${(e) => { e.preventDefault(); if (myName.trim()) act(() => api.updateMe({ displayName: myName.trim() }), 'Name saved'); }}>
      <span className="label">You</span>
      <div className="row"><input id="hh-me" type="text" className="grow" value=${myName} onChange=${(e) => setMyName(e.target.value)} /><button className="btn" type="submit">Save</button></div>
      <span className="muted small">Your color</span>
      <div className="row" style=${{ flexWrap: 'wrap' }}>${api.MEMBER_COLORS.map((c) => html`<button key=${c} type="button" className="swatch" aria-label=${'Color ' + c} aria-pressed=${mine?.color === c ? 'true' : 'false'} style=${{ background: c }} onClick=${() => act(() => api.updateMe({ color: c }))}></button>`)}</div>
    </form>
    <section className="card">
      <span className="label">Reminders</span>
      <span>When an event's reminder time arrives, the Today page shows a “Coming up” note. For a notification on your phone, open the event and choose <strong>Add to Google Calendar</strong>; the Google Calendar app sends the alert.</span>
      <span className="muted small">Tip: on iPhone, open this site in Safari and use Share → Add to Home Screen to get an app icon.</span>
    </section>
    <div className="row" style=${{ flexWrap: 'wrap' }}>
      <button className="btn secondary" onClick=${api.signOut}>Sign out</button>
      ${!leaving ? html`<button className="btn danger" onClick=${() => setLeaving(true)}>Leave home</button>` : html`
        <div className="confirm grow"><span className="grow">Leave ${home.name}? You'll lose access until someone invites you back.</span>
          <button className="btn sm ghost" onClick=${() => setLeaving(false)}>Stay</button>
          <button className="btn sm" style=${{ background: 'var(--warn)' }} onClick=${() => act(() => api.leaveHome(home.id))}>Leave</button></div>`}
    </div>`;
}

function NotConfigured() {
  return html`<main className="wrap auth"><${Brand} />
    <h1>Almost ready</h1>
    <div className="notice warn">This site doesn't have its Firebase settings yet. Add them to <code>docs/config.js</code> in the GitHub repo (see the README), and HomeIQ will start working.</div></main>`;
}

createRoot(document.getElementById('app')).render(api.configured ? html`<${Root} />` : html`<${NotConfigured} />`);
