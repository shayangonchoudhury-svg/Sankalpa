import { useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuth } from './useAuth.ts';
import { useUserProfile } from './useUserProfile.ts';
import type { Commitment, Checkin } from '../types/index.ts';
import {
  parseTimestamp,
  toCalendarDayKey,
  toCalendarWeekKey,
  toCalendarMonthKey,
  isWeekday,
} from '../utils/dateUtils.ts';

import { isCommitmentDue } from '../utils/cadenceUtils.ts';
export { isCommitmentDue };

// Module-level guard to prevent multiple evaluation runs in the same browser session on the same day
const evaluatedCalendarDayKeys = new Set<string>();

/**
 * Hook to perform client-side check-in due verification when the user opens/loads the app.
 * Enforces the strict calendar-day cap (at most 1 notification per commitment per local calendar day).
 */
export function useCheckinDueNotifier() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const runningRef = useRef<boolean>(false);

  useEffect(() => {
    if (!user || runningRef.current) return;

    // Check user preference (treat omitted as true)
    if (profile?.notificationPrefs?.checkinDue === false) {
      return;
    }

    const checkDueCommitments = async () => {
      runningRef.current = true;
      try {
        const now = new Date();
        const todayKey = toCalendarDayKey(now);
        if (!todayKey) return;

        const startOfToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0,
          0,
          0,
          0
        );

        // 1. Fetch active commitments owned by current user
        const commitmentsQuery = query(
          collection(db, 'commitments'),
          where('ownerId', '==', user.uid)
        );
        const commitmentsSnap = await getDocs(commitmentsQuery);
        const activeCommitments: Commitment[] = commitmentsSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Commitment, 'id'>) }))
          .filter((c) => !c.archived);

        if (activeCommitments.length === 0) return;

        // 2. Fetch all check-ins for the user
        const checkinsQuery = query(
          collection(db, 'checkins'),
          where('userId', '==', user.uid)
        );
        const checkinsSnap = await getDocs(checkinsQuery);
        const allCheckins: Checkin[] = checkinsSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Checkin, 'id'>),
        }));

        // 3. Evaluate each active commitment
        for (const commitment of activeCommitments) {
          if (!commitment.id) continue;

          const memoryKey = `${user.uid}_${commitment.id}_${todayKey}`;
          if (evaluatedCalendarDayKeys.has(memoryKey)) {
            continue;
          }

          const commitmentCheckins = allCheckins.filter(
            (c) => c.commitmentId === commitment.id
          );

          const isDue = isCommitmentDue(commitment, commitmentCheckins, now);
          if (!isDue) {
            evaluatedCalendarDayKeys.add(memoryKey);
            continue;
          }

          // Strict Reminder Cap: Check Firestore for existing checkin_due notification today
          const existingNotifsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', user.uid),
            where('type', '==', 'checkin_due'),
            where('relatedId', '==', commitment.id)
          );
          const notifsSnap = await getDocs(existingNotifsQuery);

          const alreadyNotifiedToday = notifsSnap.docs.some((docSnap) => {
            const data = docSnap.data();
            const createdAtDate = parseTimestamp(data.createdAt);
            return (
              createdAtDate && createdAtDate.getTime() >= startOfToday.getTime()
            );
          });

          if (alreadyNotifiedToday) {
            evaluatedCalendarDayKeys.add(memoryKey);
            continue;
          }

          // Create exactly one checkin_due notification
          evaluatedCalendarDayKeys.add(memoryKey);
          await addDoc(collection(db, 'notifications'), {
            userId: user.uid,
            type: 'checkin_due',
            title: 'Check-in due',
            body: `Your commitment "${commitment.title}" is due for a check-in.`,
            relatedId: commitment.id,
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      } catch (err: any) {
        console.warn('Check-in due notifier notice:', err.message);
      } finally {
        runningRef.current = false;
      }
    };

    checkDueCommitments();
  }, [user?.uid, profile?.notificationPrefs?.checkinDue]);
}
