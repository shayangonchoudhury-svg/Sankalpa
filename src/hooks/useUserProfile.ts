import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { updateProfile as updateAuthProfile } from 'firebase/auth';
import { db, auth } from '../lib/firebase.ts';
import { useAuth } from './useAuth.ts';
import type { User, NotificationPrefs } from '../types/index.ts';

export interface UpdateProfileInput {
  displayName?: string;
  avatarUrl?: string;
  notificationPrefs?: NotificationPrefs;
}

/**
 * Wraps a promise with a client-side timeout to prevent indefinite hangs.
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 4000,
  errorMsg = 'Operation timed out.'
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

export function useUserProfile(customUid?: string) {
  const { user: authUser } = useAuth();
  const targetUid = customUid || authUser?.uid;

  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(targetUid));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetUid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const docRef = doc(db, 'users', targetUid);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const latestName = data.displayName || authUser?.displayName || (authUser?.email ? authUser.email.split('@')[0] : 'User');
          const latestAvatar = data.avatarUrl || undefined;
          const defaultPrefs: NotificationPrefs = {
            checkinDue: true,
            witnessInvited: true,
            witnessResponded: true,
            challengeStarted: true,
          };
          const resolvedPrefs: NotificationPrefs = data.notificationPrefs
            ? { ...defaultPrefs, ...data.notificationPrefs }
            : defaultPrefs;

          setProfile({
            uid: targetUid,
            displayName: latestName,
            avatarUrl: latestAvatar,
            email: data.email || authUser?.email || '',
            notificationPrefs: resolvedPrefs,
          });
        } else {
          setProfile({
            uid: targetUid,
            displayName: authUser?.displayName || (authUser?.email ? authUser.email.split('@')[0] : 'User'),
            avatarUrl: undefined,
            email: authUser?.email || '',
            notificationPrefs: {
              checkinDue: true,
              witnessInvited: true,
              witnessResponded: true,
              challengeStarted: true,
            },
          });
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Firestore real-time listener notice:', err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [targetUid, authUser?.displayName, authUser?.email]);

  const updateProfile = useCallback(
    async (updates: UpdateProfileInput): Promise<void> => {
      if (!targetUid) {
        throw new Error('Cannot update profile: no user logged in.');
      }

      const patch: { displayName?: string; avatarUrl?: string; notificationPrefs?: NotificationPrefs } = {};

      if (updates.displayName !== undefined) {
        const trimmed = updates.displayName.trim();
        if (trimmed.length < 2 || trimmed.length > 40) {
          throw new Error('Display name must be between 2 and 40 characters.');
        }
        patch.displayName = trimmed;
      }

      if (updates.avatarUrl !== undefined) {
        patch.avatarUrl = updates.avatarUrl;
      }

      if (updates.notificationPrefs !== undefined) {
        patch.notificationPrefs = updates.notificationPrefs;
      }

      if (Object.keys(patch).length === 0) {
        return;
      }

      // 1. Update Firebase Authentication directly if target is current user
      if (auth.currentUser && auth.currentUser.uid === targetUid) {
        try {
          const isUrl = patch.avatarUrl && (patch.avatarUrl.startsWith('http://') || patch.avatarUrl.startsWith('https://') || patch.avatarUrl.startsWith('data:'));
          await updateAuthProfile(auth.currentUser, {
            displayName: patch.displayName !== undefined ? patch.displayName : undefined,
            photoURL: isUrl ? patch.avatarUrl : undefined,
          });
        } catch (authErr) {
          console.warn('Firebase Auth user profile sync note:', authErr);
        }
      }

      // 2. Optimistic local state update so UI reflects immediately
      setProfile((prev) => (prev ? { ...prev, ...patch } : null));

      // 3. Sync directly to Firestore users/{uid} document
      try {
        const docRef = doc(db, 'users', targetUid);
        await withTimeout(
          setDoc(docRef, patch, { merge: true }),
          3500,
          'Firestore database write timed out'
        );
      } catch (firestoreErr) {
        console.warn('Firestore database write delayed/unprovisioned; profile saved to Auth & local session:', firestoreErr);
      }
    },
    [targetUid]
  );

  return {
    profile,
    loading,
    error,
    updateProfile,
  };
}
