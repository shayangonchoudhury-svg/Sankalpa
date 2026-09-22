import { useEffect, useState } from 'react';

interface StreakMilestoneBadgeProps {
  commitmentId?: string;
  streak: number;
  cadence?: string;
  size?: 'sm' | 'md';
}

export function StreakMilestoneBadge({
  commitmentId,
  streak,
  cadence,
  size = 'sm',
}: StreakMilestoneBadgeProps) {
  const isWeekly = cadence === 'weekly';
  // In weekly cadence, 7/30/100 weeks or days? The prompt says "crosses: 7 days, 30 days, 100 days"
  // For daily or weekly, evaluate threshold
  const threshold = streak >= 100 ? 100 : streak >= 30 ? 30 : streak >= 7 ? 7 : 0;

  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (!threshold || !commitmentId) return;
    try {
      const storageKey = `sankalpa-milestone-${commitmentId}-${threshold}`;
      const hasSeen = sessionStorage.getItem(storageKey);
      if (!hasSeen) {
        setShouldAnimate(true);
        sessionStorage.setItem(storageKey, 'true');
      }
    } catch {
      // ignore
    }
  }, [commitmentId, threshold]);

  if (threshold === 0) return null;

  const config = {
    7: {
      label: isWeekly ? '7w Milestone' : '7d Milestone',
      title: '7-Day Milestone',
      classes: 'bg-[#3F7D5C]/10 text-[#3F7D5C] border-[#3F7D5C]/25',
      dot: 'bg-[#3F7D5C]',
    },
    30: {
      label: isWeekly ? '30w Pillar' : '30d Pillar',
      title: '30-Day Milestone',
      classes: 'bg-amber-50 text-amber-800 border-amber-200/80',
      dot: 'bg-amber-600',
    },
    100: {
      label: isWeekly ? '100w Mastery' : '100d Mastery',
      title: '100-Day Mastery',
      classes: 'bg-stone-100 text-stone-800 border-stone-300',
      dot: 'bg-stone-600',
    },
  }[threshold as 7 | 30 | 100];

  return (
    <span
      title={config.title}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium select-none transition-all ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      } ${config.classes} ${shouldAnimate ? 'milestone-enter' : ''}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span className="font-serif tracking-tight font-semibold">{config.label}</span>
    </span>
  );
}
