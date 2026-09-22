import type { Commitment, Checkin } from '../types/index.ts';
import {
  parseTimestamp,
  toCalendarDayKey,
  toCalendarWeekKey,
  toCalendarMonthKey,
  isWeekday,
} from './dateUtils.ts';

/**
 * Pure helper to evaluate whether a commitment is due on a given reference date,
 * based on its cadence and historical check-in timestamps.
 */
export function isCommitmentDue(
  commitment: Commitment,
  checkins: Checkin[],
  referenceDate: Date = new Date()
): boolean {
  if (commitment.archived) {
    return false;
  }

  const todayKey = toCalendarDayKey(referenceDate);
  if (!todayKey) return false;

  switch (commitment.cadence) {
    case 'daily': {
      // Due if no check-in exists for today
      const hasToday = checkins.some((c) => toCalendarDayKey(c.timestamp) === todayKey);
      return !hasToday;
    }

    case 'weekdays': {
      // Due only on Monday-Friday if no check-in exists for today
      if (!isWeekday(referenceDate)) {
        return false;
      }
      const hasToday = checkins.some((c) => toCalendarDayKey(c.timestamp) === todayKey);
      return !hasToday;
    }

    case 'weekly': {
      // Due if no check-in exists in the current ISO calendar week
      const currentWeekKey = toCalendarWeekKey(referenceDate);
      const hasThisWeek = checkins.some(
        (c) => toCalendarWeekKey(c.timestamp) === currentWeekKey
      );
      return !hasThisWeek;
    }

    case 'monthly': {
      // Due if no check-in exists in the current calendar month
      const currentMonthKey = toCalendarMonthKey(referenceDate);
      const hasThisMonth = checkins.some(
        (c) => toCalendarMonthKey(c.timestamp) === currentMonthKey
      );
      return !hasThisMonth;
    }

    case 'custom': {
      // Event-based: due if no check-in exists for today
      const hasToday = checkins.some((c) => toCalendarDayKey(c.timestamp) === todayKey);
      return !hasToday;
    }

    default:
      return false;
  }
}
