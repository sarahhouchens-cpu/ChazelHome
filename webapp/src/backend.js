import { getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported as messagingSupported } from 'firebase/messaging';
import {
  browserLocalPersistence, connectAuthEmulator, createUserWithEmailAndPassword, getAuth, onAuthStateChanged, sendPasswordResetEmail,
  setPersistence, signInWithEmailAndPassword, signOut as fbSignOut, updateProfile,
} from 'firebase/auth';
import {
  addDoc, arrayRemove, arrayUnion, collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, initializeFirestore, onSnapshot,
  persistentLocalCache, persistentMultipleTabManager, serverTimestamp, setDoc, updateDoc, writeBatch, getFirestore,
} from 'firebase/firestore';

/** Firebase web settings, from docs/config.js. They identify the project; they are not secrets. */
export const config = window.HOMEIQ_FIREBASE || {};
export const configured = Boolean(config.apiKey && config.projectId);

let app, auth, db;
if (configured) {
  app = getApps()[0] || initializeApp(config);
  auth = getAuth(app);
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  try {
    // Keeps working through brief connection drops and shows data instantly on reopen.
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    db = getFirestore(app);
  }
  // Local testing only: talk to the Firebase emulators instead of the real project.
  if (config.useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8085);
  }
}

export const MEMBER_COLORS = ['#1E6E57', '#B4442F', '#3A64A8', '#A2508C', '#9A6B1F', '#2F7D8F', '#6A55B0'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');


/**
 * onSnapshot that survives the moment right after creating or joining a home, when this
 * device can ask for data a beat before the server knows it's a member. A "no access"
 * answer is retried a few times before it's reported.
 */
function liveSnapshot(target, next, error) {
  let unsub = () => {}; let tries = 0; let timer; let alive = true;
  const listen = () => {
    unsub = onSnapshot(target, (snap) => { tries = 0; next(snap); }, (e) => {
      if (!alive) return;
      if (e?.code === 'permission-denied' && tries++ < 5) timer = setTimeout(listen, 600 * tries);
      else error?.(e);
    });
  };
  listen();
  return () => { alive = false; clearTimeout(timer); unsub(); };
}

// ---------- accounts ----------
export const onAuth = (fn) => onAuthStateChanged(auth, fn);
export const currentUid = () => auth.currentUser?.uid || null;

export async function signUp(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName: name.trim() });
  await setDoc(doc(db, 'users', cred.user.uid), {
    displayName: name.trim(), email: email.trim().toLowerCase(), homeId: null,
    color: MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)], createdAt: serverTimestamp(),
  });
}
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email.trim(), password);
export const signOut = () => fbSignOut(auth);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim());

export function watchUser(uid, next, error) {
  return liveSnapshot(doc(db, 'users', uid), (s) => next(s.exists() ? { id: s.id, ...s.data() } : null), error);
}
export async function updateMe(patch) {
  const me = auth.currentUser;
  await updateDoc(doc(db, 'users', me.uid), patch);
  if (patch.displayName) await updateProfile(me, { displayName: patch.displayName });
}

// ---------- homes ----------
export function watchHome(homeId, next, error) {
  return liveSnapshot(doc(db, 'homes', homeId), (s) => next(s.exists() ? { id: s.id, ...s.data() } : null), error);
}

export async function createHome(name) {
  const uid = auth.currentUser.uid;
  const homeRef = doc(db, 'homes', `${uid.slice(0, 8)}-${Date.now().toString(36)}`);
  const code = makeCode();
  const batch = writeBatch(db);
  batch.set(homeRef, { name: name.trim() || 'Our home', ownerId: uid, memberIds: [uid], inviteCode: code, createdAt: serverTimestamp() });
  batch.set(doc(db, 'invites', code), { homeId: homeRef.id });
  batch.update(doc(db, 'users', uid), { homeId: homeRef.id });
  await batch.commit();
}

export async function joinHome(rawCode) {
  const uid = auth.currentUser.uid;
  const code = rawCode.trim().toUpperCase();
  const invite = await getDoc(doc(db, 'invites', code));
  if (!invite.exists()) throw new Error('That invite code wasn’t found. Check it with the person who sent it.');
  const homeId = invite.data().homeId;
  // One atomic write; joinCode lets the security rules confirm you were invited.
  const batch = writeBatch(db);
  batch.update(doc(db, 'homes', homeId), { memberIds: arrayUnion(uid), joinCode: code });
  batch.update(doc(db, 'users', uid), { homeId });
  await batch.commit();
}

export async function leaveHome(homeId) {
  const uid = auth.currentUser.uid;
  const batch = writeBatch(db);
  batch.update(doc(db, 'homes', homeId), { memberIds: arrayRemove(uid) });
  batch.update(doc(db, 'users', uid), { homeId: null });
  await batch.commit();
}

export const renameHome = (homeId, name) => updateDoc(doc(db, 'homes', homeId), { name: name.trim() });

/**
 * The home's shared lists, as a small store: collection(name).add/onSnapshot and
 * doc("name/id").set/update/delete, all scoped to homes/<homeId>/.
 */
export function homeStore(homeId) {
  const base = ['homes', homeId];
  return {
    collection: (c) => ({
      add: (data) => addDoc(collection(db, ...base, c), data),
      onSnapshot: (next, error) => liveSnapshot(collection(db, ...base, c),
        (s) => next({ docs: s.docs.map((d) => ({ id: d.id, data: () => d.data() })), metadata: s.metadata }), error),
    }),
    doc: (path) => {
      const r = doc(db, ...base, ...path.split('/'));
      return { set: (d) => setDoc(r, d), update: (d) => updateDoc(r, d), delete: () => deleteDoc(r) };
    },
  };
}

export function friendlyError(e) {
  const map = {
    'auth/invalid-email': 'That email address doesn’t look right.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-not-found': 'No account uses that email. Create one below.',
    'auth/email-already-in-use': 'That email already has an account. Sign in instead.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
    'auth/network-request-failed': 'No internet connection. Check it and try again.',
    'auth/unauthorized-domain': 'This web address isn’t allowed to sign in yet. Add it under Firebase → Authentication → Settings → Authorized domains.',
    'permission-denied': 'You don’t have access to that. If you just joined, reload the page.',
    'unavailable': 'Can’t reach the server. Your change will save when you’re back online.',
  };
  return map[e?.code] || e?.message || 'Something went wrong. Try again.';
}

// ---------- push notifications ----------
const PUSH_FLAG = 'homeiq-push-uid';
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

/**
 * Where this device stands: 'on', 'off' (can be turned on), 'blocked' (denied in settings),
 * 'home-screen' (iPhone: must be opened from the Home Screen icon first), or 'unsupported'.
 */
export async function pushState() {
  if (isIOS() && !isStandalone()) return 'home-screen';
  if (!('serviceWorker' in navigator) || !('Notification' in window) || !(await messagingSupported().catch(() => false))) return 'unsupported';
  if (!config.vapidKey) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  let flag = null; try { flag = localStorage.getItem(PUSH_FLAG); } catch {}
  return Notification.permission === 'granted' && flag === auth.currentUser?.uid ? 'on' : 'off';
}

async function registerToken() {
  const reg = await navigator.serviceWorker.register('./sw.js');
  await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey: config.vapidKey, serviceWorkerRegistration: reg });
  if (!token) throw new Error('This browser didn\u2019t give a notification address. Try again.');
  await updateDoc(doc(db, 'users', auth.currentUser.uid), { webPushTokens: arrayUnion(token) });
  try { localStorage.setItem(PUSH_FLAG, auth.currentUser.uid); } catch {}
}

/** Ask permission (must run from a tap) and register this device. */
export async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are off for HomeIQ. Allow them in your phone\u2019s Settings → Notifications → HomeIQ.');
  await registerToken();
}

/** Tokens can change; refresh quietly on each visit once notifications are on. */
export async function refreshPush() {
  try { if ((await pushState()) === 'on') await registerToken(); } catch (e) { console.warn('push refresh failed', e); }
}
