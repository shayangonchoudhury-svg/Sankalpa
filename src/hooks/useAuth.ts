import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  UserCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<UserCredential | null>;
  signInWithEmail: (email: string, password: string) => Promise<UserCredential>;
  signUpWithEmail: (email: string, password: string) => Promise<UserCredential>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to ensure a users/{uid} document exists in Firestore upon sign in
async function ensureUserDocument(firebaseUser: User) {
  try {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      await setDoc(userDocRef, {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User'),
        email: firebaseUser.email || '',
        avatarUrl: firebaseUser.photoURL || null,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    // If Firestore rules or offline prevents this write, log warning without breaking auth session
    console.warn('Could not sync user profile to Firestore:', error);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await ensureUserDocument(currentUser);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<UserCredential | null> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await ensureUserDocument(result.user);
      }
      return result;
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        // User intentionally closed the popup window; return null gracefully without crashing
        return null;
      }
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<UserCredential> => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    if (result.user) {
      await ensureUserDocument(result.user);
    }
    return result;
  };

  const signUpWithEmail = async (email: string, password: string): Promise<UserCredential> => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (result.user) {
      await ensureUserDocument(result.user);
    }
    return result;
  };

  const signOut = async (): Promise<void> => {
    await firebaseSignOut(auth);
  };

  return React.createElement(
    AuthContext.Provider,
    {
      value: {
        user,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
      },
    },
    children
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
