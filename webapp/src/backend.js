import { getApps, initializeApp } from 'firebase/app';
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

let auth, db;
if (configured) {
  const app = getApps()[0] || initializeApp(config);
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
  return onSnapshot(doc(db, 'users', uid), (s) => next(s.exists() ? { id: s.id, ...s.data() } : null), error);
}
export async function updateMe(patch) {
  const me = auth.currentUser;
  await updateDoc(doc(db, 'users', me.uid), patch);
  if (patch.displayName) await updateProfile(me, { displayName: patch.displayName });
}

// ---------- homes ----------
export function watchHome(homeId, next, error) {
  return onSnapshot(doc(db, 'homes', homeId), (s) => next(s.exists() ? { id: s.id, ...s.data() } : null), error);
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
      onSnapshot: (next, error) => onSnapshot(collection(db, ...base, c), { includeMetadataChanges: false },
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
