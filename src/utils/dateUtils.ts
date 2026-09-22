/**
 * Date normalization and calendar utilities for SANKALPA streaks and timelines.
 * Uses the user's local calendar day consistently.
 */

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
  const d = parseTimestamp(val);
  return d ? d.getTime() : 0;
}

/**
 * Normalizes any timestamp representation into a local calendar-day string:
 * YYYY-MM-DD
 */
export function toCalendarDayKey(val: any): string | null {
  const d = parseTimestamp(val);
  if (!d) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates the difference in full calendar days between two YYYY-MM-DD keys.
 * Positive if dayKeyB is after dayKeyA.
 */
export function diffCalendarDays(dayKeyA: string, dayKeyB: string): number {
  const [yA, mA, dA] = dayKeyA.split('-').map(Number);
  const [yB, mB, dB] = dayKeyB.split('-').map(Number);
  const utcA = Date.UTC(yA, mA - 1, dA);
  const utcB = Date.UTC(yB, mB - 1, dB);
  return Math.round((utcB - utcA) / (1000 * 60 * 60 * 24));
}

/**
 * Normalizes any timestamp representation into a local calendar-week string:
 * YYYY-Www (ISO 8601 week)
 */
export function toCalendarWeekKey(val: any): string | null {
  const d = parseTimestamp(val);
  if (!d) return null;
  
  // ISO week calculation using local date
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNr = (target.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  target.setDate(target.getDate() - dayNr + 3); // Thursday of target week
  const firstThursday = target.getTime();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
  const year = new Date(firstThursday).getFullYear();
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Checks if two calendar week keys (YYYY-Www) are adjacent weeks.
 */
export function isConsecutiveWeek(prevWeekKey: string, nextWeekKey: string): boolean {
  const [prevYear, prevW] = prevWeekKey.split('-W').map(Number);
  const [nextYear, nextW] = nextWeekKey.split('-W').map(Number);

  if (prevYear === nextYear) {
    return nextW - prevW === 1;
  }
  if (nextYear === prevYear + 1) {
    // End of year transition (week 52 or 53 to week 1)
    return (prevW === 52 || prevW === 53) && nextW === 1;
  }
  return false;
}

/**
 * Normalizes any timestamp representation into a local calendar-month string:
 * YYYY-MM
 */
export function toCalendarMonthKey(val: any): string | null {
  const d = parseTimestamp(val);
  if (!d) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Checks if two calendar month keys (YYYY-MM) are adjacent consecutive months.
 */
export function isConsecutiveMonth(prevMonthKey: string, nextMonthKey: string): boolean {
  const [prevYear, prevM] = prevMonthKey.split('-').map(Number);
  const [nextYear, nextM] = nextMonthKey.split('-').map(Number);

  if (prevYear === nextYear) {
    return nextM - prevM === 1;
  }
  if (nextYear === prevYear + 1) {
    return prevM === 12 && nextM === 1;
  }
  return false;
}

/**
 * Returns true if the given timestamp or date falls on a Monday through Friday in local time.
 */
export function isWeekday(val: any): boolean {
  const d = parseTimestamp(val);
  if (!d) return false;
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  return day >= 1 && day <= 5;
}

/**
 * Checks if two Monday-Friday calendar day keys (YYYY-MM-DD) are adjacent scheduled weekdays.
 * Skips Saturday and Sunday:
 * - Friday -> Monday (diff = 3 calendar days) is consecutive.
 * - Mon -> Tue, Tue -> Wed, Wed -> Thu, Thu -> Fri (diff = 1 calendar day) are consecutive.
 */
export function isConsecutiveWeekday(dayKeyA: string, dayKeyB: string): boolean {
  const diff = diffCalendarDays(dayKeyA, dayKeyB);
  if (diff <= 0) return false;

  const [yA, mA, dA] = dayKeyA.split('-').map(Number);
  const [yB, mB, dB] = dayKeyB.split('-').map(Number);
  const dateA = new Date(yA, mA - 1, dA);
  const dateB = new Date(yB, mB - 1, dB);

  const dayOfWeekA = dateA.getDay();
  const dayOfWeekB = dateB.getDay();

  // Both days must be Monday through Friday
  if (dayOfWeekA < 1 || dayOfWeekA > 5 || dayOfWeekB < 1 || dayOfWeekB > 5) {
    return false;
  }

  // Monday through Thursday -> next day is day + 1 (diff = 1)
  if (dayOfWeekA >= 1 && dayOfWeekA <= 4) {
    return diff === 1 && dayOfWeekB === dayOfWeekA + 1;
  }

  // Friday -> next scheduled weekday is Monday (diff = 3)
  if (dayOfWeekA === 5) {
    return diff === 3 && dayOfWeekB === 1;
  }

  return false;
}

