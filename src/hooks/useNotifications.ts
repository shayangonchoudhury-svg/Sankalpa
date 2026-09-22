import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuth } from './useAuth.ts';
import type { AppNotification } from '../types/index.ts';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let active = true;

    // Primary query ordered by createdAt desc with a strict cap of 50
    const primaryQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    let unsubscribe = onSnapshot(
      primaryQuery,
      (snapshot) => {
        if (!active) return;
        const items: AppNotification[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AppNotification, 'id'>),
        }));
        setNotifications(items);
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        console.warn('Notifications index listener warning, using bounded fallback query:', err.message);
        // Resilient fallback query if composite index is pending
        const fallbackQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', user.uid),
          limit(50)
        );

        unsubscribe = onSnapshot(
          fallbackQuery,
          (fallbackSnapshot) => {
            if (!active) return;
            const items: AppNotification[] = fallbackSnapshot.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<AppNotification, 'id'>),
            }));

            // Sort newest first in memory
            items.sort((a, b) => {
              const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
              const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
              return tB - tA;
            });

            setNotifications(items);
            setLoading(false);
          },
          (fallbackErr) => {
            if (!active) return;
            console.error('Error fetching notifications:', fallbackErr);
            setError(fallbackErr.message);
            setLoading(false);
          }
        );
      }
    );

    return () => {
      active = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.uid]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!id || !user) return;
      try {
        const ref = doc(db, 'notifications', id);
        await updateDoc(ref, { read: true });
      } catch (err: any) {
        console.error('Failed to mark notification as read:', err);
      }
    },
    [user]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    const unread = notifications.filter((n) => !n.read && n.id);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        if (n.id) {
          batch.update(doc(db, 'notifications', n.id), { read: true });
        }
      });
      await batch.commit();
    } catch (err: any) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, [notifications, user]);

  return {
    notifications,
    loading,
    error,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
