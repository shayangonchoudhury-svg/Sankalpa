import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { initializeAppCheck, CustomProvider } from 'firebase/app-check';
import { getAI, GoogleAIBackend } from 'firebase/ai';

const getEnvVar = (key: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
    return (import.meta as any).env[key] || '';
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || '';
  }
  return '';
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID'),
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== 'your-api-key'
);

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Initialize Firestore with long-polling for browser environments to ensure
// rock-solid connectivity across iframes, proxies, and restricted network channels.
let firestoreDb;
try {
  firestoreDb = typeof window !== 'undefined'
    ? initializeFirestore(app, {
        experimentalForceLongPolling: true,
      })
    : getFirestore(app);
} catch {
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
export const googleProvider = new GoogleAuthProvider();
export const firebaseProjectId = firebaseConfig.projectId;

// Configure Firebase App Check for Web when debug token is provided
export let appCheck: any = null;
if (typeof window !== 'undefined' && isFirebaseConfigured) {
  try {
    const debugToken = getEnvVar('VITE_APPCHECK_DEBUG_TOKEN');
    if (debugToken) {
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
      appCheck = initializeAppCheck(app, {
        provider: new CustomProvider({
          getToken: async () => ({
            token: debugToken,
            expireTimeMillis: Date.now() + 3600 * 1000,
          }),
        }),
        isTokenAutoRefreshEnabled: true,
      });
    }
  } catch (err) {
    console.warn('Firebase App Check initialization skipped/deferred:', err);
  }
}

// Configure Firebase AI Logic with Gemini Developer API backend (Spark-compatible)
export const ai = isFirebaseConfigured
  ? getAI(app, { backend: new GoogleAIBackend() })
  : null;

export default app;
