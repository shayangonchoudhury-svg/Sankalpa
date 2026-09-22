import { Link } from 'react-router-dom';
import { Commitment } from '../../types/index.ts';
import { useStreak } from '../../hooks/useStreak.ts';
import { StreakMilestoneBadge } from './StreakMilestoneBadge.tsx';

interface CommitmentCardProps {
  commitment: Commitment;
}

function parseTimestamp(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val?.toDate === 'function') {
    try {
      const d = val.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d;
    } catch {
      // fallback
    }
  }
  if (typeof val?.seconds === 'number') {
    const d = new Date(val.seconds * 1000);
    if (!isNaN(d.getTime())) return d;
  }
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export default function CommitmentCard({ commitment }: CommitmentCardProps) {
  const { id, title, cadence, createdAt } = commitment;

  // Real-time derived streak from full approved history
  const { currentStreak, loading: streakLoading } = useStreak(id, cadence);

  // Format creation date safely
  const formattedDate = (() => {
    try {
      const date = parseTimestamp(createdAt);
      if (!date) return '';
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  })();

  // Format cadence display label
  const cadenceDisplay = (() => {
    if (!cadence) return 'Daily';
    if (cadence.startsWith('custom:')) {
      const detail = cadence.slice(7).trim();
      return detail ? `Custom: ${detail}` : 'Custom';
    }
    return cadence.charAt(0).toUpperCase() + cadence.slice(1);
  })();

  return (
    <Link
      id={`commitment-card-${id}`}
      to={`/commitments/${id}`}
      className="block p-4 rounded-[12px] border border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/60 transition-all text-neutral-900 group select-none cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3
          id={`commitment-card-title-${id}`}
          className="font-serif text-base font-semibold text-neutral-900 group-hover:text-neutral-950 transition-colors leading-snug line-clamp-2"
        >
          {title}
        </h3>
        <span
          id={`commitment-card-cadence-${id}`}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200/80 shrink-0 whitespace-nowrap capitalize"
        >
          {cadenceDisplay}
        </span>
      </div>

      {commitment.description && (
        <p className="text-xs text-neutral-500 line-clamp-2 mb-3 leading-relaxed">
          {commitment.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs pt-2 border-t border-neutral-100 mt-2">
        {/* Dynamic streak display */}
        <div className="flex items-center gap-2">
          <div
            id={`commitment-card-streak-${id}`}
            className={`inline-flex items-center gap-1.5 transition-colors ${
              currentStreak >= 7
                ? 'px-2 py-0.5 rounded-full bg-[#3F7D5C]/10 text-[#3F7D5C] font-semibold text-[11px] border border-[#3F7D5C]/20'
                : 'text-neutral-500 font-medium'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                currentStreak >= 7
                  ? 'bg-[#3F7D5C]'
                  : currentStreak > 0
                  ? 'bg-neutral-500'
                  : 'bg-neutral-300'
              }`}
            />
            <span>
              {streakLoading
                ? 'Checking streak...'
                : `${currentStreak} ${
                    cadence === 'weekly' ? 'week' : 'day'
                  } streak`}
            </span>
          </div>

          {!streakLoading && currentStreak >= 7 && (
            <StreakMilestoneBadge
              commitmentId={id}
              streak={currentStreak}
              cadence={cadence}
              size="sm"
            />
          )}
        </div>

        {/* Creation Date */}
        {formattedDate && (
          <span className="text-[11px] text-neutral-400 font-mono">
            {formattedDate}
          </span>
        )}
      </div>
    </Link>
  );
}
