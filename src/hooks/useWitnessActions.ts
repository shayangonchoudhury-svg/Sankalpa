import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  setDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuth } from './useAuth.ts';
import type { WitnessAction, WitnessResponseType, User } from '../types/index.ts';
import { handleFirestoreError, OperationType } from '../lib/firestoreError.ts';

export interface WitnessActionWithProfile extends WitnessAction {
  witnessProfile?: {
    displayName: string;
    avatarUrl?: string;
    email?: string;
  };
}

export function useWitnessActions() {
  const { user } = useAuth();

  // Track check-in IDs the current witness has already responded to
  const [myRespondedCheckinIds, setMyRespondedCheckinIds] = useState<Set<string>>(new Set());
  const [loadingMyActions, setLoadingMyActions] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setMyRespondedCheckinIds(new Set());
      setLoadingMyActions(false);
      return;
    }

    setLoadingMyActions(true);
    const q = query(
      collection(db, 'witnessActions'),
      where('witnessId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const respondedSet = new Set<string>();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.checkinId) {
            respondedSet.add(data.checkinId);
          }
        });
        setMyRespondedCheckinIds(respondedSet);
        setLoadingMyActions(false);
      },
      (err) => {
        console.error('Error listening to user witness actions:', err);
        setLoadingMyActions(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  /**
   * Submit a witness action for a check-in.
   * DOES NOT modify checkins/{id}.status.
   */
  const createWitnessAction = useCallback(
    async (
      checkinId: string,
      responseType: WitnessResponseType | 'approved' | 'asked_for_more' | 'flagged',
      note?: string
    ): Promise<string> => {
      if (!user) {
        throw new Error('You must be signed in to submit a witness action.');
      }

      const validResponses = ['approved', 'asked_for_more', 'flagged'];
      if (!validResponses.includes(responseType)) {
        throw new Error('Invalid response type.');
      }

      // Verify the check-in exists
      const checkinRef = doc(db, 'checkins', checkinId);
      const checkinSnap = await getDoc(checkinRef);
      if (!checkinSnap.exists()) {
        throw new Error('Check-in not found.');
      }
      const checkinData = checkinSnap.data();
      const commitmentId = checkinData.commitmentId;

      // Verify current user is an ACCEPTED witness for this commitment
      const inviteQuery = query(
        collection(db, 'witnessInvites'),
        where('commitmentId', '==', commitmentId),
        where('toUserId', '==', user.uid)
      );
      const inviteDocs = await getDocs(inviteQuery);
      let isAcceptedWitness = inviteDocs.docs.some(
        (d) => d.data().status === 'accepted'
      );

      // Check deterministic membership record
      const memRef = doc(db, 'commitments', commitmentId, 'witnesses', user.uid);
      const memSnap = await getDoc(memRef);
      if (memSnap.exists() && memSnap.data().status === 'accepted') {
        isAcceptedWitness = true;
      } else if (isAcceptedWitness) {
        // Sync membership record for rules evaluation with accepted inviteId
        const acceptedInvite = inviteDocs.docs.find((d) => d.data().status === 'accepted');
        if (acceptedInvite) {
          await setDoc(memRef, {
            uid: user.uid,
            status: 'accepted',
            inviteId: acceptedInvite.id,
            createdAt: serverTimestamp(),
          });
        }
      }

      if (!isAcceptedWitness) {
        throw new Error('You are not an accepted witness for this commitment.');
      }

      // Verify witness has not already responded to this check-in
      const existingActionQuery = query(
        collection(db, 'witnessActions'),
        where('checkinId', '==', checkinId),
        where('witnessId', '==', user.uid)
      );
      const existingActionDocs = await getDocs(existingActionQuery);
      if (!existingActionDocs.empty) {
        throw new Error('You have already responded to this check-in.');
      }

      // Validate optional note
      const trimmedNote = note ? note.trim() : '';
      if (trimmedNote && trimmedNote.length > 500) {
        throw new Error('Note cannot exceed 500 characters.');
      }

      try {
        // Create witnessActions document
        // NOTE: We strictly DO NOT modify checkins/{id}.status
       const actionId = `${checkinId}_${user.uid}`;
const actionRef = doc(db, 'witnessActions', actionId);

await setDoc(actionRef, {
  checkinId,
  witnessId: user.uid,
  responseType,
  ...(trimmedNote && (responseType === 'asked_for_more' || responseType === 'flagged')
    ? { note: trimmedNote }
    : {}),
  timestamp: serverTimestamp(),
});

const newActionDoc = actionRef;

        // Notify commitment/check-in owner if preference allows
        const ownerId = checkinData.userId;
        if (ownerId && ownerId !== user.uid) {
          try {
            const ownerSnap = await getDoc(doc(db, 'users', ownerId));
            if (ownerSnap.exists()) {
              const ownerData = ownerSnap.data();
              if (ownerData.notificationPrefs?.witnessResponded !== false) {
                let actionDesc = 'responded to your check-in.';
                if (responseType === 'approved') actionDesc = 'approved your check-in.';
                else if (responseType === 'asked_for_more') actionDesc = 'requested more details on your check-in.';
                else if (responseType === 'flagged') actionDesc = 'flagged your check-in.';

                await addDoc(collection(db, 'notifications'), {
                  userId: ownerId,
                  type: 'witness_responded',
                  title: 'Witness reviewed check-in',
                  body: `A witness ${actionDesc}`,
                  relatedId: checkinId,
                  read: false,
                  createdAt: serverTimestamp(),
                });
              }
            }
          } catch (notifErr: any) {
            console.warn('Notice: Failed to dispatch witness_responded notification:', notifErr.message);
          }
        }

        return newActionDoc.id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'witnessActions');
      }
    },
    [user]
  );

  return {
    createWitnessAction,
    myRespondedCheckinIds,
    loadingMyActions,
  };
}

/**
 * Hook to retrieve real-time witness actions for a single check-in,
 * resolving each witness's profile name and avatar.
 */
export function useCheckinWitnessActions(checkinId?: string) {
  const [actions, setActions] = useState<WitnessActionWithProfile[]>([]);
  const [loading, setLoading] = useState(Boolean(checkinId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checkinId) {
      setActions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'witnessActions'),
      where('checkinId', '==', checkinId)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const rawActions: WitnessAction[] = [];
        const witnessIds = new Set<string>();

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          rawActions.push({
            id: docSnap.id,
            checkinId: data.checkinId,
            witnessId: data.witnessId,
            responseType: data.responseType,
            timestamp: data.timestamp,
            note: data.note,
          });
          if (data.witnessId) {
            witnessIds.add(data.witnessId);
          }
        });

        // Sort newest first
        rawActions.sort((a, b) => {
          const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
          const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
          return timeB - timeA;
        });

        // Fetch witness profiles for display info
        const profilesMap = new Map<string, { displayName: string; avatarUrl?: string; email?: string }>();
        await Promise.all(
          Array.from(witnessIds).map(async (wId) => {
            try {
              const uSnap = await getDoc(doc(db, 'users', wId));
              if (uSnap.exists()) {
                const uData = uSnap.data();
                profilesMap.set(wId, {
                  displayName: uData.displayName || 'Witness',
                  avatarUrl: uData.avatarUrl,
                  email: uData.email,
                });
              } else {
                profilesMap.set(wId, {
                  displayName: 'Witness',
                });
              }
            } catch {
              profilesMap.set(wId, {
                displayName: 'Witness',
              });
            }
          })
        );

        const actionsWithProfile: WitnessActionWithProfile[] = rawActions.map((action) => ({
          ...action,
          witnessProfile: profilesMap.get(action.witnessId) || { displayName: 'Witness' },
        }));

        setActions(actionsWithProfile);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching checkin witness actions:', err);
        setError(err.message || 'Failed to load witness responses.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [checkinId]);

  return {
    actions,
    loading,
    error,
  };
}
