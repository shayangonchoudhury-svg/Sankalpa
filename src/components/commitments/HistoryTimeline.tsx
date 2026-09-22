import { useMemo } from 'react';
import type { Checkin } from '../../types/index.ts';
import { useCheckinApprovals } from '../../hooks/useCheckinApprovals.ts';
import { parseTimestamp } from '../../utils/dateUtils.ts';

interface HistoryTimelineProps {
  checkins: Checkin[];
  loading?: boolean;
}

export default function HistoryTimeline({ checkins, loading = false }: HistoryTimelineProps) {
  // Take the latest 30 check-ins as the bounded sample
  const recentCheckins = useMemo(() => {
    return (checkins || []).slice(0, 30);
  }, [checkins]);

  // Resolve witness approvals for the displayed check-ins
  const { isApproved, loading: approvalsLoading } = useCheckinApprovals(recentCheckins);

  // Present entries in chronological order (oldest to newest) to reflect progression
  const chronologicalCheckins = useMemo(() => {
    return [...recentCheckins].reverse();
  }, [recentCheckins]);

  if (loading || approvalsLoading) {
    return (
      <div id="timeline-loading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 bg-neutral-200 rounded animate-pulse" />
          <div className="h-3 w-16 bg-neutral-100 rounded animate-pulse" />
        </div>
        <div className="p-4 rounded-[12px] border border-neutral-200 bg-white space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-neutral-200 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-20 bg-neutral-200 rounded" />
                <div className="h-2.5 w-36 bg-neutral-100 rounded" />
              </div>
              <div className="h-3 w-12 bg-neutral-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (chronologicalCheckins.length === 0) {
    return (
      <div
        id="timeline-empty"
        className="p-5 rounded-[12px] border border-dashed border-neutral-200 bg-neutral-50/50 text-center"
      >
        <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mx-auto mb-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-xs font-medium text-neutral-700 mb-0.5">No check-ins yet.</p>
        <p className="text-[11px] text-neutral-400 max-w-xs mx-auto leading-relaxed">
          Your reflection history will appear here as you practice and witness.
        </p>
      </div>
    );
  }

  const formatTimelineDate = (val: any) => {
    const d = parseTimestamp(val);
    if (!d) return 'Recorded';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTimelineTime = (val: any) => {
    const d = parseTimestamp(val);
    if (!d) return '';
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div id="reflection-timeline-container" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-sm font-semibold text-neutral-900">
          Reflection Timeline
        </h3>
        <span className="text-[11px] text-neutral-400 font-mono">
          Last {chronologicalCheckins.length} check-ins
        </span>
      </div>

      <div className="p-4 rounded-[12px] border border-neutral-200 bg-white shadow-none">
        <div className="relative pl-6 space-y-4">
          {/* Neutral connecting vertical line */}
          <div className="timeline-line-el absolute left-[7px] top-2 bottom-2 w-px bg-neutral-200" />

          {chronologicalCheckins.map((checkin, index) => {
            const approved = checkin.id ? isApproved(checkin.id) : false;
            const isFlagged = Boolean(checkin.aiFlag?.flagged || checkin.status === 'rejected');
            const isPending = !approved && !isFlagged && (checkin.status === 'pending' || checkin.status === undefined);
            const dateStr = formatTimelineDate(checkin.timestamp);
            const timeStr = formatTimelineTime(checkin.timestamp);

            return (
              <div
                key={checkin.id || index}
                id={`timeline-entry-${checkin.id || index}`}
                className="relative flex items-start justify-between gap-3 text-xs group"
              >
                {/* Dot marker */}
                <div
                  id={`timeline-dot-${checkin.id || index}`}
                  className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full transition-transform duration-150 group-hover:scale-110 flex items-center justify-center ${
                    approved
                      ? 'bg-[#3F7D5C] ring-4 ring-white shadow-2xs'
                      : isFlagged
                      ? 'bg-red-500/90 ring-4 ring-white shadow-2xs'
                      : isPending
                      ? 'bg-amber-500 ring-4 ring-white shadow-2xs'
                      : 'border-2 border-neutral-300 bg-white ring-4 ring-white'
                  }`}
                  title={
                    approved
                      ? 'Witness Approved'
                      : isFlagged
                      ? 'Flagged for Review'
                      : isPending
                      ? 'Pending Witness Review'
                      : 'Recorded'
                  }
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-800 text-[12px]">
                      {dateStr}
                    </span>
                    {timeStr && (
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {timeStr}
                      </span>
                    )}
                  </div>

                  {checkin.note && (
                    <p className="text-[11px] text-neutral-600 line-clamp-1 mt-0.5">
                      {checkin.note}
                    </p>
                  )}
                </div>

                {/* Calm status indicator */}
                <div className="shrink-0 text-right">
                  {approved ? (
                    <span
                      id={`timeline-badge-approved-${checkin.id || index}`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3F7D5C]"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>Witnessed</span>
                    </span>
                  ) : isFlagged ? (
                    <span
                      id={`timeline-badge-flagged-${checkin.id || index}`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600"
                    >
                      <span>Flagged</span>
                    </span>
                  ) : isPending ? (
                    <span
                      id={`timeline-badge-pending-${checkin.id || index}`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600"
                    >
                      <span>Review</span>
                    </span>
                  ) : (
                    <span
                      id={`timeline-badge-recorded-${checkin.id || index}`}
                      className="text-[11px] text-neutral-400"
                    >
                      Recorded
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
