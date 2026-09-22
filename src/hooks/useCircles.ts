import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  serverTimestamp,
  writeBatch,
  runTransaction,
  updateDoc,
  arrayUnion,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuth } from './useAuth.ts';
import { Circle, CircleMember, CircleInvite } from '../types/index.ts';
import { handleFirestoreError, OperationType } from '../lib/firestoreError.ts';

export function useCircles(activeCircleId?: string) {
  const { user } = useAuth();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [activeCircle, setActiveCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<CircleInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Subscribe to circles the user belongs to
  useEffect(() => {
    if (!user) {
      setCircles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'circles'),
      where('members', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Circle[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as Omit<Circle, 'id'>) });
        });
        setCircles(list);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'circles');
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 2. Subscribe to active circle document & its members
  useEffect(() => {
    if (!user || !activeCircleId) {
      setActiveCircle(null);
      setMembers([]);
      return;
    }

    const circleRef = doc(db, 'circles', activeCircleId);
    const unsubCircle = onSnapshot(
      circleRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setActiveCircle({ id: docSnap.id, ...(docSnap.data() as Omit<Circle, 'id'>) });
        } else {
          setActiveCircle(null);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `circles/${activeCircleId}`);
      }
    );

    const membersRef = collection(db, 'circles', activeCircleId, 'members');
    const unsubMembers = onSnapshot(
      membersRef,
      (snapshot) => {
        const memberList: CircleMember[] = [];
        snapshot.forEach((docSnap) => {
          memberList.push(docSnap.data() as CircleMember);
        });
        setMembers(memberList);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `circles/${activeCircleId}/members`);
      }
    );

    return () => {
      unsubCircle();
      unsubMembers();
    };
  }, [user, activeCircleId]);

  // 3. Subscribe to pending invitations for current user's email
  useEffect(() => {
    if (!user || !user.email) {
      setPendingInvites([]);
      return;
    }

    const email = user.email.toLowerCase().trim();
    const q = query(
      collection(db, 'circleInvites'),
      where('toEmail', '==', email),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CircleInvite[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as Omit<CircleInvite, 'id'>) });
        });
        setPendingInvites(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'circleInvites');
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Create Circle atomically with owner membership
  const createCircle = useCallback(
    async (name: string): Promise<string> => {
      if (!user) throw new Error('Must be signed in to create a circle');
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 50) {
        throw new Error('Circle name must be between 2 and 50 characters');
      }

      setError(null);
      try {
        const batch = writeBatch(db);
        const circleRef = doc(collection(db, 'circles'));
        const circleId = circleRef.id;

        const circleData: Omit<Circle, 'id'> = {
          name: trimmed,
          ownerId: user.uid,
          memberCount: 1,
          members: [user.uid],
          createdAt: serverTimestamp(),
        };

        const memberRef = doc(db, 'circles', circleId, 'members', user.uid);
        const memberData: CircleMember = {
          uid: user.uid,
          email: user.email ? user.email.toLowerCase().trim() : '',
          status: 'accepted',
          invitedBy: user.uid,
          createdAt: serverTimestamp(),
        };

        batch.set(circleRef, circleData);
        batch.set(memberRef, memberData);

        await batch.commit();
        return circleId;
      } catch (err: any) {
        handleFirestoreError(err, OperationType.CREATE, 'circles');
        setError(err.message || 'Failed to create circle');
        throw err;
      }
    },
    [user]
  );

  // Invite member by email
  const inviteMember = useCallback(
    async (circleId: string, circleName: string, recipientEmail: string) => {
      if (!user) throw new Error('Must be signed in to invite members');
      const email = recipientEmail.trim().toLowerCase();
      if (!email || !email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }
      if (user.email && email === user.email.toLowerCase().trim()) {
        throw new Error('You cannot invite yourself to a circle');
      }

      setError(null);
      try {
        // Check circle exists and member count
        const circleRef = doc(db, 'circles', circleId);
        const circleSnap = await getDoc(circleRef);
        if (!circleSnap.exists()) {
          throw new Error('Circle does not exist');
        }
        const circleData = circleSnap.data() as Circle;
        if ((circleData.memberCount || 0) >= 10) {
          throw new Error('Circle has reached the maximum of 10 accepted members');
        }

        // Check for existing pending invite for this email in this circle
        const existingInvitesQ = query(
          collection(db, 'circleInvites'),
          where('circleId', '==', circleId),
          where('toEmail', '==', email),
          where('status', '==', 'pending')
        );
        const existingInvites = await getDocs(existingInvitesQ);
        if (!existingInvites.empty) {
          throw new Error('A pending invitation already exists for this email');
        }

        // Check if member already in circle
        const membersSnap = await getDocs(collection(db, 'circles', circleId, 'members'));
        const alreadyMember = membersSnap.docs.some(
          (d) => (d.data() as CircleMember).email?.toLowerCase() === email && d.data().status === 'accepted'
        );
        if (alreadyMember) {
          throw new Error('This user is already an accepted member of this circle');
        }

        const inviteRef = doc(collection(db, 'circleInvites'));
        const inviteData: Omit<CircleInvite, 'id'> = {
          circleId,
          circleName,
          fromUserId: user.uid,
          toEmail: email,
          toUserId: null,
          status: 'pending',
          createdAt: serverTimestamp(),
        };

        const batch = writeBatch(db);
        batch.set(inviteRef, inviteData);
        await batch.commit();
      } catch (err: any) {
        handleFirestoreError(err, OperationType.CREATE, 'circleInvites');
        setError(err.message || 'Failed to send circle invitation');
        throw err;
      }
    },
    [user]
  );

  // Accept circle invite atomically in a transaction
  const acceptCircleInvite = useCallback(
    async (inviteId: string, circleId: string) => {
      if (!user || !user.email) throw new Error('Must be signed in to accept invitation');
      const currentUserEmail = user.email.toLowerCase().trim();

      setError(null);
      try {
        await runTransaction(db, async (transaction) => {
          const inviteRef = doc(db, 'circleInvites', inviteId);
          const circleRef = doc(db, 'circles', circleId);
          const memberRef = doc(db, 'circles', circleId, 'members', user.uid);

          const inviteSnap = await transaction.get(inviteRef);
          if (!inviteSnap.exists()) {
            throw new Error('Invitation does not exist');
          }
          const inviteData = inviteSnap.data() as CircleInvite;
          if (inviteData.status !== 'pending') {
            throw new Error('Invitation is no longer pending');
          }
          if (inviteData.toEmail.toLowerCase() !== currentUserEmail) {
            throw new Error('You are not authorized to accept this invitation');
          }

          const circleSnap = await transaction.get(circleRef);
          if (!circleSnap.exists()) {
            throw new Error('Circle does not exist');
          }
          const circleData = circleSnap.data() as Circle;
          const currentCount = circleData.memberCount || 0;
          if (currentCount >= 10) {
            throw new Error('Circle has reached the maximum of 10 accepted members');
          }

          // 1. Mark invite accepted
          transaction.update(inviteRef, {
            status: 'accepted',
            toUserId: user.uid,
          });

          // 2. Write deterministic member record
          const memberData: CircleMember = {
            uid: user.uid,
            email: currentUserEmail,
            status: 'accepted',
            invitedBy: inviteData.fromUserId,
            createdAt: serverTimestamp(),
          };
          transaction.set(memberRef, {
            ...memberData,
            inviteId,
          });

          // 3. Atomically update circle memberCount and denormalized members array
          transaction.update(circleRef, {
            memberCount: currentCount + 1,
            members: arrayUnion(user.uid),
          });
        });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, 'circleInvites');
        setError(err.message || 'Failed to accept invitation');
        throw err;
      }
    },
    [user]
  );

  // Decline circle invite
  const declineCircleInvite = useCallback(
    async (inviteId: string) => {
      if (!user) throw new Error('Must be signed in to decline invitation');
      setError(null);
      try {
        const inviteRef = doc(db, 'circleInvites', inviteId);
        await updateDoc(inviteRef, {
          status: 'declined',
        });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, 'circleInvites');
        setError(err.message || 'Failed to decline invitation');
        throw err;
      }
    },
    [user]
  );

  return {
    circles,
    activeCircle,
    members,
    pendingInvites,
    loading,
    error,
    createCircle,
    inviteMember,
    acceptCircleInvite,
    declineCircleInvite,
  };
}
