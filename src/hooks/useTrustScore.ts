import { useMemo } from 'react';
import { useCommitments } from './useCommitments.ts';
import { useAllUserCheckins } from './useCheckins.ts';
import { useCheckinApprovals } from './useCheckinApprovals.ts';
import { calculateDailyStreak } from '../utils/streakCalculator.ts';

export interface TrustScoreDetails {
  score: number;
  label: string;
  totalCheckins: number;
  approvedCount: number;
  flaggedCount: number;
  unrespondedCount: number;
  activeCommitmentsCount: number;
  loading: boolean;
}

export function getTrustLabel(score: number): string {
  if (score >= 90) return 'Highly consistent';
  if (score >= 70) return 'Reliable';
  if (score >= 40) return 'Building trust';
  return 'Just starting';
}

/**
 * Derives a private, deterministic 0–100 self-reflection trust metric
 * for the authenticated user.
 *
 * MUST ONLY be displayed on the user's private Profile page.
 * NEVER written to Firestore.
 */
export function useTrustScore(): TrustScoreDetails {
  const { commitments, loading: commitmentsLoading } = useCommitments();
  const { checkins, loading: checkinsLoading } = useAllUserCheckins();
  const { approvedIds, flaggedIds, reviewedIds, loading: approvalsLoading } = useCheckinApprovals(checkins);

  const activeCommitments = useMemo(
    () => commitments.filter((c) => !c.archived),
    [commitments]
  );

  const result = useMemo(() => {
    const totalCheckins = checkins.length;

    let approvedCount = 0;
    let flaggedCount = 0;
    let unrespondedCount = 0;

    checkins.forEach((c) => {
      const id = c.id;
      if (!id) return;
      if (approvedIds.has(id)) {
        approvedCount += 1;
      } else if (flaggedIds.has(id)) {
        flaggedCount += 1;
      } else if (!reviewedIds.has(id)) {
        unrespondedCount += 1;
      }
    });

    // If no commitments or no check-ins submitted: score = 0, "Just starting"
    if (activeCommitments.length === 0 && totalCheckins === 0) {
      return {
        score: 0,
        label: 'Just starting',
        totalCheckins: 0,
        approvedCount: 0,
        flaggedCount: 0,
        unrespondedCount: 0,
        activeCommitmentsCount: 0,
      };
    }

    // 1. Approval rate: approvedCheckins / totalCheckins
    const approvalRate = totalCheckins > 0 ? approvedCount / totalCheckins : 0;

    // 2. Consistency across active commitments:
    // Average normalized streak: 0 streak = 0, 7+ day streak = 1
    let consistencySum = 0;
    if (activeCommitments.length > 0) {
      activeCommitments.forEach((commitment) => {
        // Find approved check-ins for this commitment
        const commitmentApprovedCheckins = checkins.filter(
          (c) => c.commitmentId === commitment.id && c.id && approvedIds.has(c.id)
        );
        const streakData = calculateDailyStreak(commitmentApprovedCheckins);
        const normalized = Math.min(streakData.currentStreak / 7, 1);
        consistencySum += normalized;
      });
    }

    const consistencyScore =
      activeCommitments.length > 0 ? consistencySum / activeCommitments.length : 0;

    // Deterministic 0-100 formula:
    // (approvalRate * 70) + (consistencyScore * 30)
    let rawScore = 0;
    if (totalCheckins > 0 || activeCommitments.length > 0) {
      rawScore = Math.round(approvalRate * 70 + consistencyScore * 30);
    }
    const clampedScore = Math.max(0, Math.min(100, rawScore));
    const label = getTrustLabel(clampedScore);

    return {
      score: clampedScore,
      label,
      totalCheckins,
      approvedCount,
      flaggedCount,
      unrespondedCount,
      activeCommitmentsCount: activeCommitments.length,
    };
  }, [checkins, activeCommitments, approvedIds, flaggedIds, reviewedIds]);

  return {
    ...result,
    loading: commitmentsLoading || checkinsLoading || approvalsLoading,
  };
}
