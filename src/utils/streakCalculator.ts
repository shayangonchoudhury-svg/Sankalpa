/**
 * Deterministic streak calculation engine for SANKALPA.
 * Handles Daily, Weekly, Weekdays, Monthly, and Custom cadences.
 */

import {
  toCalendarDayKey,
  diffCalendarDays,
  toCalendarWeekKey,
  isConsecutiveWeek,
  toCalendarMonthKey,
  isConsecutiveMonth,
  isConsecutiveWeekday,
  isWeekday,
} from './dateUtils.ts';
import type { Checkin } from '../types/index.ts';

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  totalApprovedDays: number;
}

/**
 * Calculates streak metrics for a daily commitment.
 */
export function calculateDailyStreak(
  approvedCheckins: Checkin[],
  referenceDate: Date = new Date()
): StreakResult {
  if (!approvedCheckins || approvedCheckins.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalApprovedDays: 0 };
  }

  // 1. Collapse multiple check-ins on the same day into unique calendar day keys (YYYY-MM-DD)
  const uniqueDaysSet = new Set<string>();
  approvedCheckins.forEach((c) => {
    const dayKey = toCalendarDayKey(c.timestamp);
    if (dayKey) {
      uniqueDaysSet.add(dayKey);
    }
  });

  const totalApprovedDays = uniqueDaysSet.size;
  if (totalApprovedDays === 0) {
    return { currentStreak: 0, longestStreak: 0, totalApprovedDays: 0 };
  }

  // Sort unique days ascending: e.g. ["2026-09-01", "2026-09-02", ...]
  const sortedDays = Array.from(uniqueDaysSet).sort();

  // 2. Calculate Longest Streak
  let longestStreak = 1;
  let runningStreak = 1;

  for (let i = 1; i < sortedDays.length; i++) {
    const prevDay = sortedDays[i - 1];
    const currDay = sortedDays[i];
    const diff = diffCalendarDays(prevDay, currDay);

    if (diff === 1) {
      runningStreak += 1;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else if (diff > 1) {
      runningStreak = 1;
    }
  }

  // 3. Calculate Current Streak
  // The current streak is the consecutive run ending at the most recent completed day.
  // Do NOT automatically force today's date to be present.
  // A user who completed yesterday has an active current streak until a gap breaks the run.
  const todayKey = toCalendarDayKey(referenceDate);
  const mostRecentDay = sortedDays[sortedDays.length - 1];

  let currentStreak = 0;
  if (todayKey && mostRecentDay) {
    const gapFromToday = diffCalendarDays(mostRecentDay, todayKey);

    // If most recent completed day was today (gap=0) or yesterday (gap=1), streak is active!
    // If gap >= 2, at least one full calendar day was missed -> streak is broken (0).
    if (gapFromToday <= 1) {
      let streakCount = 1;
      for (let i = sortedDays.length - 1; i > 0; i--) {
        const curr = sortedDays[i];
        const prev = sortedDays[i - 1];
        if (diffCalendarDays(prev, curr) === 1) {
          streakCount += 1;
        } else {
          break;
        }
      }
      currentStreak = streakCount;
    } else {
      currentStreak = 0;
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalApprovedDays,
  };
}

/**
 * Calculates streak metrics for a weekly commitment.
 * A week counts as completed when at least one approved check-in falls within that calendar week.
 */
export function calculateWeeklyStreak(
  approvedCheckins: Checkin[],
  referenceDate: Date = new Date()
): StreakResult {
  if (!approvedCheckins || approvedCheckins.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalApprovedDays: 0 };
  }

  // Collapse into unique calendar week keys (YYYY-Www)
  const uniqueWeeksSet = new Set<string>();
  approvedCheckins.forEach((c) => {
    const weekKey = toCalendarWeekKey(c.timestamp);
    if (weekKey) {
      uniqueWeeksSet.add(weekKey);
    }
  });

  const totalApprovedDays = uniqueWeeksSet.size;
  if (totalApprovedDays === 0) {
    return { currentStreak: 0, longestStreak: 0, totalApprovedDays: 0 };
  }

  const sortedWeeks = Array.from(uniqueWeeksSet).sort();

  // Longest streak
  let longestStreak = 1;
  let runningStreak = 1;

  for (let i = 1; i < sortedWeeks.length; i++) {
    const prev = sortedWeeks[i - 1];
    const curr = sortedWeeks[i];
    if (isConsecutiveWeek(prev, curr)) {
      runningStreak += 1;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else {
      runningStreak = 1;
    }
  }

  // Current streak
  const thisWeekKey = toCalendarWeekKey(referenceDate);
  const mostRecentWeek = sortedWeeks[sortedWeeks.length - 1];

  let currentStreak = 0;
  if (thisWeekKey && mostRecentWeek) {
    // Active if completed this week or last week
    const isActive =
      mostRecentWeek === thisWeekKey || isConsecutiveWeek(mostRecentWeek, thisWeekKey);

    if (isActive) {
      let streakCount = 1;
      for (let i = sortedWeeks.length - 1; i > 0; i--) {
        const curr = sortedWeeks[i];
        const prev = sortedWeeks[i - 1];
        if (isConsecutiveWeek(prev, curr)) {
          streakCount += 1;
        } else {
          break;
        }
      }
      currentStreak = streakCount;
    } else {
      currentStreak = 0;
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalApprovedDays,
  };
}

/**
 * Calculates streak metrics for a weekdays (Monday through Friday) commitment.
 * Saturday and Sunday are NOT required completion days and do NOT break the streak.
 */
export function calculateWeekdaysStreak(
  approvedCheckins: Checkin[],
  referenceDate: Date = new Date()
): StreakResult {
  if (!approvedCheckins || approvedCheckins.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalApprovedDays: 0 };
  }

  // 1. Collapse multiple check-ins into unique completed weekdays (Mon-Fri)
  const uniqueWeekdaysSet = new Set<string>();
  approvedCheckins.forEach((c) => {
    if (isWeekday(c.timestamp)) {
      const dayKey = toCalendarDayKey(c.timestamp);
      if (dayKey) {
        uniqueWeekdaysSet.add(dayKey);
      }
    }
  });

  const totalApprovedDays = uniqueWeekdaysSet.size;
  if (totalApprovedDays === 0) {
    return { currentStreak: 0, longestStreak: 0, totalApprovedDays: 0 };
  }

  const sortedWeekdays = Array.from(uniqueWeekdaysSet).sort();

  // 2. Longest streak calculation across complete history
  let longestStreak = 1;
  let runningStreak = 1;

  for (let i = 1; i < sortedWeekdays.length; i++) {
    const prev = sortedWeekdays[i - 1];
    const curr = sortedWeekdays[i];
    if (isConsecutiveWeekday(prev, curr)) {
      runningStreak += 1;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else {
      runningStreak = 1;
    }
  }

  // 3. Current streak calculation
  // The streak remains active if the most recent completed weekday was today (if today is a weekday)
  // or the most recent scheduled weekday before today.
  const refDayOfWeek = referenceDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const acceptableDays: string[] = [];

  const getOffsetDayKey = (offset: number): string => {
    const d = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate() - offset
    );
    return toCalendarDayKey(d) || '';
  };

  if (refDayOfWeek === 0) {
    // Sunday: Friday was 2 days ago
    acceptableDays.push(getOffsetDayKey(2));
  } else if (refDayOfWeek === 6) {
    // Saturday: Friday was 1 day ago
    acceptableDays.push(getOffsetDayKey(1));
  } else if (refDayOfWeek === 1) {
    // Monday: Today (0) or previous scheduled weekday Friday (3 days ago)
    acceptableDays.push(getOffsetDayKey(0));
    acceptableDays.push(getOffsetDayKey(3));
  } else {
    // Tuesday through Friday (2 - 5): Today (0) or yesterday (1)
    acceptableDays.push(getOffsetDayKey(0));
    acceptableDays.push(getOffsetDayKey(1));
  }

  const mostRecentCompleted = sortedWeekdays[sortedWeekdays.length - 1];
  const isActive = acceptableDays.includes(mostRecentCompleted);

  let currentStreak = 0;
  if (isActive) {
    let streakCount = 1;
    for (let i = sortedWeekdays.length - 1; i > 0; i--) {
      const curr = sortedWeekdays[i];
      const prev = sortedWeekdays[i - 1];
      if (isConsecutiveWeekday(prev, curr)) {
        streakCount += 1;
      } else {
        break;
      }
    }
    currentStreak = streakCount;
  } else {
    currentStreak = 0;
  }

  return {
    currentStreak,
    longestStreak,
    totalApprovedDays,
  };
}

/**
 * Calculates streak metrics for a monthly commitment.
 * A month counts as completed when at least one approved check-in falls within that calendar month (YYYY-MM).
 */
export function calculateMonthlyStreak(
  approvedCheckins: Checkin[],
  referenceDate: Date = new Date()
): StreakResult {
  if (!approvedCheckins || approvedCheckins.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalApprovedDays: 0 };
  }

  // 1. Collapse multiple check-ins into unique completed months (YYYY-MM)
  const uniqueMonthsSet = new Set<string>();
  approvedCheckins.forEach((c) => {
    const monthKey = toCalendarMonthKey(c.timestamp);
    if (monthKey) {
      uniqueMonthsSet.add(monthKey);
    }
  });

  const totalApprovedDays = uniqueMonthsSet.size;
  if (totalApprovedDays === 0) {
    return { currentStreak: 0, longestStreak: 0, totalApprovedDays: 0 };
  }

  const sortedMonths = Array.from(uniqueMonthsSet).sort();

  // 2. Longest streak calculation
  let longestStreak = 1;
  let runningStreak = 1;

  for (let i = 1; i < sortedMonths.length; i++) {
    const prev = sortedMonths[i - 1];
    const curr = sortedMonths[i];
    if (isConsecutiveMonth(prev, curr)) {
      runningStreak += 1;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else {
      runningStreak = 1;
    }
  }

  // 3. Current streak calculation
  // The streak remains active if the most recent completed month is the current month
  // or the immediately preceding calendar month.
  const thisMonthKey = toCalendarMonthKey(referenceDate);
  const mostRecentMonth = sortedMonths[sortedMonths.length - 1];

  let currentStreak = 0;
  if (thisMonthKey && mostRecentMonth) {
    const isActive =
      mostRecentMonth === thisMonthKey || isConsecutiveMonth(mostRecentMonth, thisMonthKey);

    if (isActive) {
      let streakCount = 1;
      for (let i = sortedMonths.length - 1; i > 0; i--) {
        const curr = sortedMonths[i];
        const prev = sortedMonths[i - 1];
        if (isConsecutiveMonth(prev, curr)) {
          streakCount += 1;
        } else {
          break;
        }
      }
      currentStreak = streakCount;
    } else {
      currentStreak = 0;
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalApprovedDays,
  };
}

/**
 * Calculates streak metrics for a custom cadence commitment.
 * MVP behavior: event-based consecutive approved check-in events.
 */
export function calculateCustomStreak(
  allCheckinsChronological: Checkin[],
  approvedIds: Set<string>
): StreakResult {
  if (!allCheckinsChronological || allCheckinsChronological.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalApprovedDays: 0 };
  }

  let totalApprovedDays = 0;
  let longestStreak = 0;
  let runningStreak = 0;

  for (const c of allCheckinsChronological) {
    const isApproved = c.id ? approvedIds.has(c.id) : false;
    if (isApproved) {
      totalApprovedDays += 1;
      runningStreak += 1;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else {
      runningStreak = 0;
    }
  }

  // Current streak: consecutive approved events from latest event backwards
  let currentStreak = 0;
  for (let i = allCheckinsChronological.length - 1; i >= 0; i--) {
    const c = allCheckinsChronological[i];
    const isApproved = c.id ? approvedIds.has(c.id) : false;
    if (isApproved) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalApprovedDays,
  };
}
