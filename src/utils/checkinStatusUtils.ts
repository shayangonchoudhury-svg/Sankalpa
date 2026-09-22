import type { WitnessAction } from '../types/index.ts';

export type CheckinDisplayStatus =
  | 'Approved'
  | 'More evidence requested'
  | 'Flagged'
  | 'Awaiting witness'
  | 'Recorded';

export interface CheckinStatusInfo {
  status: CheckinDisplayStatus;
  badgeStyle: string;
}

/**
 * Pure helper to derive the human-readable display status for a check-in,
 * following Phase 8 witness action semantics without modifying checkins.status:
 *
 * 1. At least one witness action has responseType === 'approved' -> "Approved"
 * 2. No approval exists, but the latest/relevant witness response is 'asked_for_more' -> "More evidence requested"
 * 3. A witness response is 'flagged' (or latest non-approval is flagged) -> "Flagged"
 * 4. No witness response exists, but witnessing applies to commitment -> "Awaiting witness"
 * 5. If the commitment has no witnessing relationship and there is no witness response -> "Recorded"
 */
export function deriveCheckinDisplayStatus(
  actions: WitnessAction[] = [],
  hasWitnessRelationship: boolean = false
): CheckinStatusInfo {
  // 1. Phase 8 Rule: At least one approved witness action = Approved
  const hasApproved = actions.some((a) => a.responseType === 'approved');
  if (hasApproved) {
    return {
      status: 'Approved',
      badgeStyle: 'bg-[#3F7D5C]/10 text-[#3F7D5C] border-[#3F7D5C]/20',
    };
  }

  // 2. If witness actions exist (none approved), inspect responses
  if (actions.length > 0) {
    // Sort descending by timestamp (newest first)
    const sorted = [...actions].sort((a, b) => {
      const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
      const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });

    const latest = sorted[0];

    // Priority to latest response
    if (latest.responseType === 'asked_for_more') {
      return {
        status: 'More evidence requested',
        badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    }

    if (latest.responseType === 'flagged') {
      return {
        status: 'Flagged',
        badgeStyle: 'bg-[#C26D55]/10 text-[#C26D55] border-[#C26D55]/30',
      };
    }

    // Fallback if latest was another action type
    if (sorted.some((a) => a.responseType === 'flagged')) {
      return {
        status: 'Flagged',
        badgeStyle: 'bg-[#C26D55]/10 text-[#C26D55] border-[#C26D55]/30',
      };
    }

    if (sorted.some((a) => a.responseType === 'asked_for_more')) {
      return {
        status: 'More evidence requested',
        badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    }
  }

  // 3. No witness response exists:
  if (hasWitnessRelationship) {
    return {
      status: 'Awaiting witness',
      badgeStyle: 'bg-neutral-100 text-neutral-600 border-neutral-200/80',
    };
  }

  return {
    status: 'Recorded',
    badgeStyle: 'bg-neutral-100 text-neutral-600 border-neutral-200/80',
  };
}
