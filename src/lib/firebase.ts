import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
// getReactNativePersistence is only exported from the React Native build of firebase/auth,
// which Metro resolves at runtime. The type is declared in src/types/firebase-rn.d.ts.
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

const firstInit = getApps().length === 0;
// Placeholders keep the SDK from throwing at import time; the app shows a setup screen instead.
export const app = firstInit
  ? initializeApp(
      isFirebaseConfigured ? firebaseConfig : { apiKey: 'not-configured', projectId: 'not-configured', appId: 'not-configured' },
    )
  : getApp();

function createAuth(): Auth {
  if (!firstInit) return getAuth(app);
  if (Platform.OS === 'web') return getAuth(app);
  // Keeps each person signed in between app launches.
  return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}

export const auth = createAuth();
export const db = getFirestore(app);
