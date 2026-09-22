import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuth } from './useAuth.ts';
import { Commitment } from '../types/index.ts';
import { handleFirestoreError, OperationType } from '../lib/firestoreError.ts';

/**
 * Helper to safely extract a valid Date from Firestore serverTimestamp or other timestamp formats.
 */
export function parseTimestamp(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val?.toDate === 'function') {
    try {
      const d = val.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d;
    } catch {
      return null;
    }
  }
  if (typeof val?.seconds === 'number') {
    const d = new Date(val.seconds * 1000);
    if (!isNaN(d.getTime())) return d;
  }
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Helper to safely extract numeric milliseconds for in-memory sorting.
 * Safely handles Firestore Timestamp, Date, numeric timestamp, ISO string,
 * null, undefined, or pending serverTimestamp (treating unresolved values as 0).
 */
export function getTimestampMillis(val: any): number {
  if (!val) return 0;
  if (val instanceof Date) return isNaN(val.getTime()) ? 0 : val.getTime();
  if (typeof val?.toMillis === 'function') {
    try {
      return val.toMillis() || 0;
    } catch {
      return 0;
    }
  }
  if (typeof val?.toDate === 'function') {
    try {
      const d = val.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d.getTime() : 0;
    } catch {
      return 0;
    }
  }
  if (typeof val?.seconds === 'number') {
    return val.seconds * 1000;
  }
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
}

export function useCommitments() {
  const { user, loading: authLoading } = useAuth();
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const retry = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setCommitments([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Single-field Firestore query: ownerId == user.uid
    // Avoids requiring composite indexes. Sorting is performed in application memory.
    const commitmentsQuery = query(
      collection(db, 'commitments'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      commitmentsQuery,
      (snapshot) => {
        const items: Commitment[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ownerId: data.ownerId,
            title: data.title || '',
            cadence: data.cadence || 'daily',
            visibility: data.visibility || 'private',
            circleId: data.circleId || undefined,
            createdAt: data.createdAt,
            description: data.description || '',
            archived: Boolean(data.archived),
          };
        });

        // In-memory sort: newest commitment first
        items.sort((a, b) => {
          const timeA = getTimestampMillis(a.createdAt);
          const timeB = getTimestampMillis(b.createdAt);
          return timeB - timeA;
        });

        setCommitments(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore commitments onSnapshot error:', err);
        setError('Unable to sync commitments. Please check your connection.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading, refreshKey]);

  /**
   * Creates a new commitment directly in Firestore.
   */
  const createCommitment = useCallback(
    async (title: string, cadence: string, description?: string): Promise<string> => {
      if (!user) {
        throw new Error('You must be signed in to create a commitment.');
      }

      const trimmedTitle = (title || '').trim();
      if (!trimmedTitle || trimmedTitle.length < 3) {
        throw new Error('Title must be at least 3 characters long.');
      }
      if (trimmedTitle.length > 100) {
        throw new Error('Title cannot exceed 100 characters.');
      }

      const trimmedDesc = (description || '').trim();
      if (trimmedDesc.length > 500) {
        throw new Error('Description cannot exceed 500 characters.');
      }

      if (!cadence || cadence.trim().length === 0) {
        throw new Error('Please select a valid cadence.');
      }

      const payload = {
        ownerId: user.uid,
        title: trimmedTitle,
        cadence: cadence.trim(),
        description: trimmedDesc,
        visibility: 'private',
        createdAt: serverTimestamp(),
        archived: false,
      };

      try {
        const docRef = await addDoc(collection(db, 'commitments'), payload);
        return docRef.id;
      } catch (error) {
        console.error('Failed to create commitment in Firestore:', error);
        handleFirestoreError(error, OperationType.CREATE, 'commitments');
      }
    },
    [user]
  );

  /**
   * Updates an existing commitment directly in Firestore.
   */
  const updateCommitment = useCallback(
    async (
      id: string,
      updates: { title?: string; cadence?: string; description?: string }
    ): Promise<void> => {
      if (!user) {
        throw new Error('You must be signed in to update a commitment.');
      }

      if (!id) {
        throw new Error('Commitment ID is required for update.');
      }

      const patch: { title?: string; cadence?: string; description?: string } = {};

      if (updates.title !== undefined) {
        const trimmedTitle = updates.title.trim();
        if (!trimmedTitle || trimmedTitle.length < 3) {
          throw new Error('Title must be at least 3 characters long.');
        }
        if (trimmedTitle.length > 100) {
          throw new Error('Title cannot exceed 100 characters.');
        }
        patch.title = trimmedTitle;
      }

      if (updates.cadence !== undefined) {
        if (!updates.cadence || updates.cadence.trim().length === 0) {
          throw new Error('Please select a valid cadence.');
        }
        patch.cadence = updates.cadence.trim();
      }

      if (updates.description !== undefined) {
        const trimmedDesc = updates.description.trim();
        if (trimmedDesc.length > 500) {
          throw new Error('Description cannot exceed 500 characters.');
        }
        patch.description = trimmedDesc;
      }

      if (Object.keys(patch).length === 0) {
        return;
      }

      // Check ownership
      const existing = commitments.find((c) => c.id === id);
      if (existing && existing.ownerId !== user.uid) {
        throw new Error('You do not have permission to update this commitment.');
      }

      try {
        const commitmentRef = doc(db, 'commitments', id);
        await updateDoc(commitmentRef, patch);
      } catch (error) {
        console.error('Failed to update commitment in Firestore:', error);
        handleFirestoreError(error, OperationType.UPDATE, `commitments/${id}`);
      }
    },
    [user, commitments]
  );

  /**
   * Soft-archives a commitment directly in Firestore (archived: true).
   */
  const archiveCommitment = useCallback(
    async (id: string): Promise<void> => {
      if (!user) {
        throw new Error('You must be signed in to archive a commitment.');
      }

      if (!id) {
        throw new Error('Commitment ID is required.');
      }

      // Check ownership
      const existing = commitments.find((c) => c.id === id);
      if (existing && existing.ownerId !== user.uid) {
        throw new Error('You do not have permission to archive this commitment.');
      }

      try {
        const commitmentRef = doc(db, 'commitments', id);
        await updateDoc(commitmentRef, { archived: true });
      } catch (error) {
        console.error('Failed to archive commitment in Firestore:', error);
        handleFirestoreError(error, OperationType.UPDATE, `commitments/${id}`);
      }
    },
    [user, commitments]
  );

  return {
    commitments,
    loading,
    error,
    retry,
    createCommitment,
    updateCommitment,
    archiveCommitment,
  };
}
