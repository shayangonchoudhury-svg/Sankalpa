import { useMemo } from 'react';
import { useCheckins } from './useCheckins.ts';
import { useCheckinApprovals } from './useCheckinApprovals.ts';
import {
  calculateDailyStreak,
  calculateWeeklyStreak,
  calculateWeekdaysStreak,
  calculateMonthlyStreak,
  calculateCustomStreak,
  StreakResult,
} from '../utils/streakCalculator.ts';

export interface UseStreakResult extends StreakResult {
  loading: boolean;
}

/**
 * Derives current streak, longest streak, and total completed days for a commitment.
 * Uses full relevant history and requires witness approval.
 * Purely derived on read — NEVER written to Firestore.
 */
export function useStreak(commitmentId?: string, cadence: string = 'daily'): UseStreakResult {
  // Request full history for this commitment without arbitrary 20-item truncation
  const { checkins, loading: checkinsLoading } = useCheckins(commitmentId, { unbounded: true });

  // Resolve witness approvals for check-ins
  const { approvedIds, loading: approvalsLoading } = useCheckinApprovals(checkins);

  const streakResult = useMemo<StreakResult>(() => {
    if (!checkins || checkins.length === 0) {
      return { currentStreak: 0, longestStreak: 0, totalApprovedDays: 0 };
    }

    const normalizedCadence = (cadence || 'daily').toLowerCase().trim();

    // Filter to only check-ins with verified witness approval
    const approvedCheckins = checkins.filter((c) => c.id && approvedIds.has(c.id));

    if (normalizedCadence === 'daily') {
      return calculateDailyStreak(approvedCheckins);
    }

    if (normalizedCadence === 'weekly') {
      return calculateWeeklyStreak(approvedCheckins);
    }

    if (normalizedCadence === 'weekdays') {
      return calculateWeekdaysStreak(approvedCheckins);
    }

    if (normalizedCadence === 'monthly') {
      return calculateMonthlyStreak(approvedCheckins);
    }

    if (normalizedCadence.startsWith('custom') || normalizedCadence === 'custom') {
      // Checkins chronologically ordered (oldest to newest)
      const chronological = [...checkins].reverse();
      return calculateCustomStreak(chronological, approvedIds);
    }

    // Default fallback for other cadences
    return calculateDailyStreak(approvedCheckins);
  }, [checkins, approvedIds, cadence]);

  return {
    ...streakResult,
    loading: checkinsLoading || approvalsLoading,
  };
}
