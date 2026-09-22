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
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuth } from './useAuth.ts';
import type { WitnessInvite } from '../types/index.ts';
import { handleFirestoreError, OperationType } from '../lib/firestoreError.ts';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useWitnessInvites(commitmentId?: string) {
  const { user } = useAuth();
  const normalizedUserEmail = user?.email ? user.email.trim().toLowerCase() : '';

  // 1. Pending invites sent to the current user's email
  const [pendingReceivedInvites, setPendingReceivedInvites] = useState<WitnessInvite[]>([]);
  const [pendingReceivedLoading, setPendingReceivedLoading] = useState(true);
  const [pendingReceivedError, setPendingReceivedError] = useState<string | null>(null);

  // 2. Accepted invites where current user is the accepted witness
  const [acceptedWitnessInvites, setAcceptedWitnessInvites] = useState<WitnessInvite[]>([]);
  const [acceptedWitnessLoading, setAcceptedWitnessLoading] = useState(true);
  const [acceptedWitnessError, setAcceptedWitnessError] = useState<string | null>(null);

  // 3. Invites associated with a specific commitment (for the commitment owner)
  const [commitmentInvites, setCommitmentInvites] = useState<WitnessInvite[]>([]);
  const [commitmentInvitesLoading, setCommitmentInvitesLoading] = useState(Boolean(commitmentId));
  const [commitmentInvitesError, setCommitmentInvitesError] = useState<string | null>(null);

  // Subscribe to pending invites received by current user's normalized email
  useEffect(() => {
    if (!normalizedUserEmail) {
      setPendingReceivedInvites([]);
      setPendingReceivedLoading(false);
      return;
    }

    setPendingReceivedLoading(true);
    setPendingReceivedError(null);

    const q = query(
      collection(db, 'witnessInvites'),
      where('toEmail', '==', normalizedUserEmail)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: WitnessInvite[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.status === 'pending') {
            list.push({
              id: docSnap.id,
              commitmentId: data.commitmentId,
              fromUserId: data.fromUserId,
              toEmail: data.toEmail,
              toUserId: data.toUserId || null,
              status: data.status,
              createdAt: data.createdAt,
            });
          }
        });

        // Sort newest first in memory
        list.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });

        setPendingReceivedInvites(list);
        setPendingReceivedLoading(false);
      },
      (err) => {
        console.error('Error fetching received witness invites:', err);
        setPendingReceivedError(err.message || 'Failed to load received witness invites.');
        setPendingReceivedLoading(false);
      }
    );

    return () => unsubscribe();
  }, [normalizedUserEmail]);

  // Subscribe to accepted invites where current user is the accepted witness
  useEffect(() => {
    if (!user?.uid) {
      setAcceptedWitnessInvites([]);
      setAcceptedWitnessLoading(false);
      return;
    }

    setAcceptedWitnessLoading(true);
    setAcceptedWitnessError(null);

    const q = query(
      collection(db, 'witnessInvites'),
      where('toUserId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: WitnessInvite[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.status === 'accepted') {
            list.push({
              id: docSnap.id,
              commitmentId: data.commitmentId,
              fromUserId: data.fromUserId,
              toEmail: data.toEmail,
              toUserId: data.toUserId,
              status: data.status,
              createdAt: data.createdAt,
            });
          }
        });

        setAcceptedWitnessInvites(list);
        setAcceptedWitnessLoading(false);
      },
      (err) => {
        console.error('Error fetching accepted witness invites:', err);
        setAcceptedWitnessError(err.message || 'Failed to load accepted witness commitments.');
        setAcceptedWitnessLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Ensure deterministic membership record exists for any accepted witness commitments
  useEffect(() => {
    if (!user?.uid || acceptedWitnessInvites.length === 0) return;
    acceptedWitnessInvites.forEach(async (inv) => {
      if (inv.commitmentId && inv.status === 'accepted') {
        try {
          const memRef = doc(db, 'commitments', inv.commitmentId, 'witnesses', user.uid);
          const memSnap = await getDoc(memRef);
          if (!memSnap.exists()) {
            await setDoc(memRef, {
              uid: user.uid,
              status: 'accepted',
              inviteId: inv.id,
              createdAt: serverTimestamp(),
            });
          }
        } catch (e) {
          console.warn('Witness membership sync note:', e);
        }
      }
    });
  }, [user?.uid, acceptedWitnessInvites]);

  // Subscribe to invites for a specific commitment
  useEffect(() => {
    if (!commitmentId) {
      setCommitmentInvites([]);
      setCommitmentInvitesLoading(false);
      return;
    }

    setCommitmentInvitesLoading(true);
    setCommitmentInvitesError(null);

    const q = query(
      collection(db, 'witnessInvites'),
      where('commitmentId', '==', commitmentId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: WitnessInvite[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            commitmentId: data.commitmentId,
            fromUserId: data.fromUserId,
            toEmail: data.toEmail,
            toUserId: data.toUserId || null,
            status: data.status,
            createdAt: data.createdAt,
          });
        });

        // Sort newest first
        list.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });

        setCommitmentInvites(list);
        setCommitmentInvitesLoading(false);
      },
      (err) => {
        console.error('Error fetching commitment invites:', err);
        setCommitmentInvitesError(err.message || 'Failed to load commitment witness invites.');
        setCommitmentInvitesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [commitmentId]);

  /**
   * Create a new witness invitation for a commitment
   */
  const createInvite = useCallback(
    async (targetCommitmentId: string, toEmail: string): Promise<string> => {
      if (!user) {
        throw new Error('You must be signed in to send a witness invitation.');
      }

      const normalizedTargetEmail = toEmail.trim().toLowerCase();
      if (!normalizedTargetEmail) {
        throw new Error('Please provide an email address.');
      }

      if (!EMAIL_REGEX.test(normalizedTargetEmail)) {
        throw new Error('Please enter a valid email address.');
      }

      const currentNormalizedEmail = (user.email || '').trim().toLowerCase();
      if (normalizedTargetEmail === currentNormalizedEmail) {
        throw new Error('You cannot invite yourself as a witness.');
      }

      // Verify the commitment belongs to the current user
      const commitmentRef = doc(db, 'commitments', targetCommitmentId);
      const commitmentSnap = await getDoc(commitmentRef);
      if (!commitmentSnap.exists()) {
        throw new Error('Commitment not found.');
      }
      if (commitmentSnap.data().ownerId !== user.uid) {
        throw new Error('You can only invite witnesses to your own commitments.');
      }

      // Check for existing pending invite for the same commitment and email
      const existingQuery = query(
        collection(db, 'witnessInvites'),
        where('commitmentId', '==', targetCommitmentId),
        where('toEmail', '==', normalizedTargetEmail)
      );
      const existingDocs = await getDocs(existingQuery);

      const hasPending = existingDocs.docs.some(
        (d) => d.data().status === 'pending'
      );
      if (hasPending) {
        throw new Error('This person already has a pending invitation for this commitment.');
      }

      // Also check if already accepted
      const hasAccepted = existingDocs.docs.some(
        (d) => d.data().status === 'accepted'
      );
      if (hasAccepted) {
        throw new Error('This person is already an accepted witness for this commitment.');
      }

      // Create new invite
      const docRef = await addDoc(collection(db, 'witnessInvites'), {
        commitmentId: targetCommitmentId,
        fromUserId: user.uid,
        toEmail: normalizedTargetEmail,
        toUserId: null,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // Check if recipient has an existing account and wants notifications
      try {
        const userQuery = query(
          collection(db, 'users'),
          where('email', '==', normalizedTargetEmail)
        );
        const userDocs = await getDocs(userQuery);
        if (!userDocs.empty) {
          const recipientDoc = userDocs.docs[0];
          const recipientData = recipientDoc.data();
          if (recipientData.notificationPrefs?.witnessInvited !== false) {
            await addDoc(collection(db, 'notifications'), {
              userId: recipientDoc.id,
              type: 'witness_invited',
              title: 'New witness invitation',
              body: "You've been invited to witness a commitment.",
              relatedId: targetCommitmentId,
              read: false,
              createdAt: serverTimestamp(),
            });
          }
        }
      } catch (notifErr: any) {
        console.warn('Notice: Failed to dispatch witness_invited notification:', notifErr.message);
      }

      return docRef.id;
    },
    [user]
  );

  /**
   * Accept an invitation addressed to the current user
   */
  const acceptInvite = useCallback(
    async (inviteId: string): Promise<void> => {
      if (!user) {
        throw new Error('You must be signed in to accept an invitation.');
      }

      const inviteRef = doc(db, 'witnessInvites', inviteId);
      const inviteSnap = await getDoc(inviteRef);
      if (!inviteSnap.exists()) {
        throw new Error('Invitation not found.');
      }

      const data = inviteSnap.data();
      const currentNormalizedEmail = (user.email || '').trim().toLowerCase();

      if ((data.toEmail || '').trim().toLowerCase() !== currentNormalizedEmail) {
        throw new Error('This invitation is not addressed to your email address.');
      }

      if (data.status !== 'pending') {
        throw new Error('This invitation is no longer pending.');
      }

      await updateDoc(inviteRef, {
        status: 'accepted',
        toUserId: user.uid,
      });

      // Deterministic witness membership authorization record for security rules
      const membershipRef = doc(db, 'commitments', data.commitmentId, 'witnesses', user.uid);
      await setDoc(membershipRef, {
        uid: user.uid,
        status: 'accepted',
        inviteId: inviteId,
        createdAt: serverTimestamp(),
      });

      // Notify the inviter that their invitation was accepted
      if (data.fromUserId) {
        try {
          const inviterSnap = await getDoc(doc(db, 'users', data.fromUserId));
          if (inviterSnap.exists()) {
            const inviterData = inviterSnap.data();
            if (inviterData.notificationPrefs?.witnessResponded !== false) {
              await addDoc(collection(db, 'notifications'), {
                userId: data.fromUserId,
                type: 'witness_responded',
                title: 'Witness invitation accepted',
                body: 'A witness accepted your invitation.',
                relatedId: data.commitmentId,
                read: false,
                createdAt: serverTimestamp(),
              });
            }
          }
        } catch (notifErr: any) {
          console.warn('Notice: Failed to dispatch witness_responded notification:', notifErr.message);
        }
      }
    },
    [user]
  );

  /**
   * Decline an invitation addressed to the current user
   */
  const declineInvite = useCallback(
    async (inviteId: string): Promise<void> => {
      if (!user) {
        throw new Error('You must be signed in to decline an invitation.');
      }

      const inviteRef = doc(db, 'witnessInvites', inviteId);
      const inviteSnap = await getDoc(inviteRef);
      if (!inviteSnap.exists()) {
        throw new Error('Invitation not found.');
      }

      const data = inviteSnap.data();
      const currentNormalizedEmail = (user.email || '').trim().toLowerCase();

      if ((data.toEmail || '').trim().toLowerCase() !== currentNormalizedEmail) {
        throw new Error('This invitation is not addressed to your email address.');
      }

      if (data.status !== 'pending') {
        throw new Error('This invitation is no longer pending.');
      }

      await updateDoc(inviteRef, {
        status: 'declined',
      });
    },
    [user]
  );

  return {
    pendingReceivedInvites,
    pendingReceivedLoading,
    pendingReceivedError,
    acceptedWitnessInvites,
    acceptedWitnessLoading,
    acceptedWitnessError,
    commitmentInvites,
    commitmentInvitesLoading,
    commitmentInvitesError,
    createInvite,
    acceptInvite,
    declineInvite,
  };
}
