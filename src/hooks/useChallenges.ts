import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  serverTimestamp,
  writeBatch,
  getDocs,
  getDoc,
  addDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuth } from './useAuth.ts';
import { Challenge, ChallengeParticipant, Commitment, CircleMember } from '../types/index.ts';
import { handleFirestoreError, OperationType } from '../lib/firestoreError.ts';

export interface StartChallengeParams {
  circleId: string;
  title: string;
  cadence: 'daily' | 'weekly' | 'weekdays' | 'monthly' | 'custom';
  description?: string;
}

export function useChallenges(circleId?: string, activeChallengeId?: string) {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<ChallengeParticipant[]>([]);
  const [participantCommitments, setParticipantCommitments] = useState<Record<string, Commitment>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Subscribe to challenges for this circle
  useEffect(() => {
    if (!user || !circleId) {
      setChallenges([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'challenges'),
      where('circleId', '==', circleId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Challenge[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as Omit<Challenge, 'id'>) });
        });
        setChallenges(list);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'challenges');
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, circleId]);

  // 2. Subscribe to active challenge document & its participants
  useEffect(() => {
    if (!user || !activeChallengeId) {
      setActiveChallenge(null);
      setParticipants([]);
      setParticipantCommitments({});
      return;
    }

    const challengeRef = doc(db, 'challenges', activeChallengeId);
    const unsubChallenge = onSnapshot(
      challengeRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setActiveChallenge({ id: docSnap.id, ...(docSnap.data() as Omit<Challenge, 'id'>) });
        } else {
          setActiveChallenge(null);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `challenges/${activeChallengeId}`);
      }
    );

    const participantsRef = collection(db, 'challenges', activeChallengeId, 'participants');
    const unsubParticipants = onSnapshot(
      participantsRef,
      async (snapshot) => {
        const parts: ChallengeParticipant[] = [];
        snapshot.forEach((docSnap) => {
          parts.push(docSnap.data() as ChallengeParticipant);
        });
        setParticipants(parts);

        // Fetch corresponding commitments for participants
        const commitmentsMap: Record<string, Commitment> = {};
        for (const part of parts) {
          if (part.commitmentId) {
            try {
              const cSnap = await getDoc(doc(db, 'commitments', part.commitmentId));
              if (cSnap.exists()) {
                commitmentsMap[part.uid] = {
                  id: cSnap.id,
                  ...(cSnap.data() as Omit<Commitment, 'id'>),
                };
              }
            } catch (cErr) {
              console.warn(`Could not load commitment ${part.commitmentId}:`, cErr);
            }
          }
        }
        setParticipantCommitments(commitmentsMap);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `challenges/${activeChallengeId}/participants`);
      }
    );

    return () => {
      unsubChallenge();
      unsubParticipants();
    };
  }, [user, activeChallengeId]);

  // 3. Start a new challenge atomically for ALL accepted members of the circle
  const startChallenge = useCallback(
    async (params: StartChallengeParams): Promise<string> => {
      if (!user) throw new Error('Must be signed in to start a challenge');
      const title = params.title.trim();
      if (title.length < 3 || title.length > 100) {
        throw new Error('Challenge title must be between 3 and 100 characters');
      }

      setError(null);
      try {
        // Fetch circle members
        const membersRef = collection(db, 'circles', params.circleId, 'members');
        const membersSnap = await getDocs(membersRef);
        const acceptedMembers: CircleMember[] = [];
        membersSnap.forEach((d) => {
          const m = d.data() as CircleMember;
          if (m.status === 'accepted') {
            acceptedMembers.push(m);
          }
        });

        if (acceptedMembers.length === 0) {
          throw new Error('No accepted members found in circle');
        }

        // Verify current user is an accepted member
        const isUserMember = acceptedMembers.some((m) => m.uid === user.uid);
        if (!isUserMember) {
          throw new Error('Only accepted circle members can start a challenge');
        }

        const batch = writeBatch(db);
        const challengeRef = doc(collection(db, 'challenges'));
        const challengeId = challengeRef.id;

        const challengeData: Omit<Challenge, 'id'> = {
          circleId: params.circleId,
          title,
          cadence: params.cadence,
          description: params.description?.trim() || '',
          createdBy: user.uid,
          active: true,
          createdAt: serverTimestamp(),
        };

        batch.set(challengeRef, challengeData);

        // For each accepted member, atomically create commitment and participant record
        for (const member of acceptedMembers) {
          const commitmentRef = doc(collection(db, 'commitments'));
          const commitmentId = commitmentRef.id;

          const commitmentData: Omit<Commitment, 'id'> = {
            ownerId: member.uid,
            title,
            cadence: params.cadence,
            visibility: 'circle',
            archived: false,
            description: params.description?.trim() || '',
            circleId: params.circleId,
            challengeId,
            createdAt: serverTimestamp(),
          };

          const participantRef = doc(db, 'challenges', challengeId, 'participants', member.uid);
          const participantData: ChallengeParticipant = {
            uid: member.uid,
            circleId: params.circleId,
            commitmentId,
            joinedAt: serverTimestamp(),
          };

          batch.set(commitmentRef, commitmentData);
          batch.set(participantRef, participantData);
        }

        // Atomic commit
        await batch.commit();

        // Notify ONLY the users actually included in the challenge participant batch
        for (const member of acceptedMembers) {
          try {
            const memberUserSnap = await getDoc(doc(db, 'users', member.uid));
            if (memberUserSnap.exists()) {
              const memberUserData = memberUserSnap.data();
              if (memberUserData.notificationPrefs?.challengeStarted !== false) {
                await addDoc(collection(db, 'notifications'), {
                  userId: member.uid,
                  type: 'challenge_started',
                  title: 'New challenge started',
                  body: `A new challenge "${title}" has started in your circle.`,
                  relatedId: challengeId,
                  read: false,
                  createdAt: serverTimestamp(),
                });
              }
            }
          } catch (notifErr: any) {
            console.warn('Notice: Failed to dispatch challenge_started notification:', notifErr.message);
          }
        }

        return challengeId;
      } catch (err: any) {
        handleFirestoreError(err, OperationType.CREATE, 'challenges');
        setError(err.message || 'Failed to start challenge');
        throw err;
      }
    },
    [user]
  );

  return {
    challenges,
    activeChallenge,
    participants,
    participantCommitments,
    loading,
    error,
    startChallenge,
  };
}
