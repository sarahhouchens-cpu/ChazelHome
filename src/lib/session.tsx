import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth, db } from './firebase';
import type { Home, UserProfile } from './types';

const MEMBER_COLORS = ['#4F7A6B', '#C26B4F', '#5B6BB5', '#B5895B', '#8E5BB5', '#4F94A8'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

type Session = {
  initializing: boolean;
  user: User | null;
  profile: UserProfile | null;
  home: Home | null;
  members: UserProfile[];
  memberById: (id: string | null | undefined) => UserProfile | undefined;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  createHome: (name: string) => Promise<void>;
  joinHome: (code: string) => Promise<void>;
  leaveHome: () => Promise<void>;
  renameHome: (name: string) => Promise<void>;
  updateMyProfile: (patch: Partial<Pick<UserProfile, 'displayName' | 'color'>>) => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [home, setHome] = useState<Home | null>(null);
  // Which homeId the `home` state reflects, so we know when it's still loading.
  const [homeLoadedFor, setHomeLoadedFor] = useState<string | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthReady(true);
        if (!u) {
          setProfile(null);
          setProfileReady(true);
        }
      }),
    [],
  );

  // My profile document.
  useEffect(() => {
    if (!user) return;
    setProfileReady(false);
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        setProfile(snap.exists() ? ({ id: snap.id, ...snap.data() } as UserProfile) : null);
        setProfileReady(true);
      },
      () => setProfileReady(true),
    );
  }, [user]);

  // The home I belong to.
  const homeId = profile?.homeId ?? null;
  useEffect(() => {
    if (!homeId) {
      setHome(null);
      setHomeLoadedFor(null);
      return;
    }
    return onSnapshot(
      doc(db, 'homes', homeId),
      (snap) => {
        setHome(snap.exists() ? ({ id: snap.id, ...snap.data() } as Home) : null);
        setHomeLoadedFor(homeId);
      },
      () => {
        // Not a member (any more) or the home was deleted: fall back to onboarding.
        setHome(null);
        setHomeLoadedFor(homeId);
      },
    );
  }, [homeId]);

  // Everyone in the home.
  const memberKey = home?.memberIds.join(',') ?? '';
  useEffect(() => {
    if (!memberKey) {
      setMembers([]);
      return;
    }
    const ids = memberKey.split(',');
    const found = new Map<string, UserProfile>();
    const unsubs = ids.map((id) =>
      onSnapshot(
        doc(db, 'users', id),
        (snap) => {
          if (snap.exists()) found.set(id, { id, ...snap.data() } as UserProfile);
          setMembers(ids.map((i) => found.get(i)).filter((m): m is UserProfile => Boolean(m)));
        },
        (err) => console.warn('Could not load housemate profile', err),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [memberKey]);

  const value = useMemo<Session>(() => {
    const requireUser = () => {
      if (!auth.currentUser) throw new Error('You need to be signed in.');
      return auth.currentUser;
    };
    return {
      initializing: !authReady || (Boolean(user) && !profileReady) || (Boolean(homeId) && homeLoadedFor !== homeId),
      user,
      profile,
      home,
      members,
      memberById: (id) => (id ? members.find((m) => m.id === id) : undefined),

      async signUp(name, email, password) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim() });
        await setDoc(doc(db, 'users', cred.user.uid), {
          displayName: name.trim(),
          email: email.trim().toLowerCase(),
          homeId: null,
          color: MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)],
          pushTokens: [],
          createdAt: serverTimestamp(),
        });
      },
      async signIn(email, password) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      async signOut() {
        await fbSignOut(auth);
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(auth, email.trim());
      },

      async createHome(name) {
        const me = requireUser();
        const homeRef = doc(db, 'homes', `${me.uid.slice(0, 8)}-${Date.now().toString(36)}`);
        const code = makeInviteCode();
        const batch = writeBatch(db);
        batch.set(homeRef, {
          name: name.trim() || 'Our Home',
          ownerId: me.uid,
          memberIds: [me.uid],
          inviteCode: code,
          createdAt: serverTimestamp(),
        });
        batch.set(doc(db, 'invites', code), { homeId: homeRef.id });
        batch.update(doc(db, 'users', me.uid), { homeId: homeRef.id });
        await batch.commit();
      },

      async joinHome(rawCode) {
        const me = requireUser();
        const code = rawCode.trim().toUpperCase();
        const invite = await getDoc(doc(db, 'invites', code));
        if (!invite.exists()) throw new Error('That invite code was not found. Double-check it and try again.');
        const targetHomeId = invite.data().homeId as string;
        // One atomic write, so nobody's live listeners see a half-joined state.
        // joinCode lets the security rules verify we were invited.
        const batch = writeBatch(db);
        batch.update(doc(db, 'homes', targetHomeId), { memberIds: arrayUnion(me.uid), joinCode: code });
        batch.update(doc(db, 'users', me.uid), { homeId: targetHomeId });
        await batch.commit();
      },

      async leaveHome() {
        const me = requireUser();
        if (!home) return;
        const batch = writeBatch(db);
        batch.update(doc(db, 'homes', home.id), { memberIds: arrayRemove(me.uid) });
        batch.update(doc(db, 'users', me.uid), { homeId: null });
        await batch.commit();
      },

      async renameHome(name) {
        if (!home) return;
        await updateDoc(doc(db, 'homes', home.id), { name: name.trim() });
      },

      async updateMyProfile(patch) {
        const me = requireUser();
        await updateDoc(doc(db, 'users', me.uid), patch);
        if (patch.displayName) await updateProfile(me, { displayName: patch.displayName });
      },
    };
  }, [authReady, profileReady, homeId, homeLoadedFor, user, profile, home, members]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** For screens inside the signed-in, has-a-home part of the app. */
export function useHome() {
  const s = useSession();
  if (!s.user || !s.home) throw new Error('useHome used outside a home');
  return { ...s, user: s.user, home: s.home, uid: s.user.uid, homeId: s.home.id };
}
