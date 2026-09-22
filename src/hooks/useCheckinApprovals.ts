import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import type { Checkin } from '../types/index.ts';

// In-memory module cache of known immutable states
// Since witnessActions cannot be updated or deleted in Firestore rules,
// once an approval is found it is permanent.
const globalApprovedSet = new Set<string>();
const globalFlaggedSet = new Set<string>();
const globalReviewedSet = new Set<string>();

export interface CheckinApprovalsResult {
  approvedIds: Set<string>;
  flaggedIds: Set<string>;
  reviewedIds: Set<string>;
  loading: boolean;
  isApproved: (checkinId: string) => boolean;
}

/**
 * Deterministically resolves witness approval state for a set of check-ins.
 * Reuses existing single-equality Firestore query `where('checkinId', '==', id)`
 * compliant with strict security rules.
 */
export function useCheckinApprovals(checkins: Checkin[]): CheckinApprovalsResult {
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set(globalApprovedSet));
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set(globalFlaggedSet));
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set(globalReviewedSet));
  const [loading, setLoading] = useState<boolean>(true);

  // Keep track of active listeners to avoid duplicate subscriptions
  const unsubsRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    if (!checkins || checkins.length === 0) {
      setLoading(false);
      return;
    }

    const checkinIds = checkins
      .map((c) => c.id)
      .filter((id): id is string => Boolean(id));

    if (checkinIds.length === 0) {
      setLoading(false);
      return;
    }

    let pendingCount = 0;
    const currentApproved = new Set(globalApprovedSet);
    const currentFlagged = new Set(globalFlaggedSet);
    const currentReviewed = new Set(globalReviewedSet);

    // Identify which check-ins need listeners
    checkinIds.forEach((id) => {
      // If already permanently approved, no listener needed
      if (globalApprovedSet.has(id)) {
        return;
      }

      // If already subscribed, skip creating another listener
      if (unsubsRef.current.has(id)) {
        return;
      }

      pendingCount++;

      const q = query(
        collection(db, 'witnessActions'),
        where('checkinId', '==', id)
      );

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          let hasApproved = false;
          let hasFlagged = false;
          let hasAny = !snapshot.empty;

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.responseType === 'approved') {
              hasApproved = true;
            } else if (data.responseType === 'flagged') {
              hasFlagged = true;
            }
          });

          let changed = false;

          if (hasAny) {
            globalReviewedSet.add(id);
            currentReviewed.add(id);
            changed = true;
          }

          if (hasFlagged) {
            globalFlaggedSet.add(id);
            currentFlagged.add(id);
            changed = true;
          }

          if (hasApproved) {
            globalApprovedSet.add(id);
            currentApproved.add(id);
            changed = true;
            // Once approved, witnessActions cannot be mutated or deleted.
            // We can cleanly detach this listener to save resources.
            const activeUnsub = unsubsRef.current.get(id);
            if (activeUnsub) {
              activeUnsub();
              unsubsRef.current.delete(id);
            }
          }

          if (changed) {
            setApprovedIds(new Set(globalApprovedSet));
            setFlaggedIds(new Set(globalFlaggedSet));
            setReviewedIds(new Set(globalReviewedSet));
          }
        },
        (err) => {
          console.error(`Error querying witnessActions for checkin ${id}:`, err);
        }
      );

      unsubsRef.current.set(id, unsub);
    });

    setApprovedIds(new Set(globalApprovedSet));
    setFlaggedIds(new Set(globalFlaggedSet));
    setReviewedIds(new Set(globalReviewedSet));
    setLoading(false);

    // Cleanup: clean listeners for checkins that are no longer in this list
    const activeIdSet = new Set(checkinIds);
    unsubsRef.current.forEach((unsub, subId) => {
      if (!activeIdSet.has(subId)) {
        unsub();
        unsubsRef.current.delete(subId);
      }
    });
  }, [checkins]);

  // Clean up all subscriptions on unmount
  useEffect(() => {
    return () => {
      unsubsRef.current.forEach((unsub) => unsub());
      unsubsRef.current.clear();
    };
  }, []);

  const isApproved = (checkinId: string): boolean => {
    return approvedIds.has(checkinId) || globalApprovedSet.has(checkinId);
  };

  return {
    approvedIds,
    flaggedIds,
    reviewedIds,
    loading,
    isApproved,
  };
}

export {
  deriveCheckinDisplayStatus,
  type CheckinDisplayStatus,
  type CheckinStatusInfo,
} from '../utils/checkinStatusUtils.ts';
