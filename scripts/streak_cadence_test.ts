/**
 * Comprehensive streak verification test suite for SANKALPA Phase 8.1
 */
import {
  calculateDailyStreak,
  calculateWeeklyStreak,
  calculateWeekdaysStreak,
  calculateMonthlyStreak,
  calculateCustomStreak,
} from '../src/utils/streakCalculator.ts';
import {
  diffCalendarDays,
  toCalendarDayKey,
  toCalendarMonthKey,
  isConsecutiveMonth,
  isConsecutiveWeekday,
} from '../src/utils/dateUtils.ts';
import type { Checkin } from '../src/types/index.ts';

function mockCheckin(id: string, dateStr: string): Checkin {
  // Parse dateStr (e.g. "2026-09-18T10:00:00")
  const d = new Date(dateStr);
  return {
    id,
    commitmentId: 'comm-1',
    userId: 'user-1',
    evidenceType: 'none',
    timestamp: {
      toDate: () => d,
      seconds: Math.floor(d.getTime() / 1000),
      nanoseconds: (d.getTime() % 1000) * 1000000,
    } as any,
    status: 'pending', // source of truth is not status
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName} ${detail || ''}`);
    failed++;
  }
}

console.log('========================================================================');
console.log('SANKALPA PHASE 8.1 STREAK CADENCE VERIFICATION');
console.log('========================================================================\n');

// 1. Mon → Tue → Wed → Thu → Fri
// Sept 14 (Mon) to Sept 18 (Fri) 2026. Ref: Friday Sept 18.
const tc1 = [
  mockCheckin('1', '2026-09-14T10:00:00'),
  mockCheckin('2', '2026-09-15T10:00:00'),
  mockCheckin('3', '2026-09-16T10:00:00'),
  mockCheckin('4', '2026-09-17T10:00:00'),
  mockCheckin('5', '2026-09-18T10:00:00'),
];
const res1 = calculateWeekdaysStreak(tc1, new Date('2026-09-18T12:00:00'));
assert(res1.currentStreak === 5 && res1.longestStreak === 5 && res1.totalApprovedDays === 5,
  'WEEKDAYS-01: Mon -> Tue -> Wed -> Thu -> Fri produces streak of 5',
  JSON.stringify(res1));

// 2. Fri → Monday
// Friday Sept 18 and Monday Sept 21. Ref: Monday Sept 21.
const tc2 = [
  mockCheckin('1', '2026-09-18T10:00:00'),
  mockCheckin('2', '2026-09-21T10:00:00'),
];
const res2 = calculateWeekdaysStreak(tc2, new Date('2026-09-21T12:00:00'));
assert(res2.currentStreak === 2 && res2.longestStreak === 2 && res2.totalApprovedDays === 2,
  'WEEKDAYS-02: Fri -> Monday is consecutive (streak 2)',
  JSON.stringify(res2));

// 3. Fri → Saturday → Sunday → Monday
// Checkin on Friday Sept 18, reference date on Sunday Sept 20 (weekend keeps Friday active)
const res3a = calculateWeekdaysStreak([mockCheckin('1', '2026-09-18T10:00:00')], new Date('2026-09-20T12:00:00'));
assert(res3a.currentStreak === 1,
  'WEEKDAYS-03a: Friday check-in remains active on Sunday',
  JSON.stringify(res3a));

// Reference date on Saturday Sept 19 (weekend keeps Friday active)
const res3b = calculateWeekdaysStreak([mockCheckin('1', '2026-09-18T10:00:00')], new Date('2026-09-19T12:00:00'));
assert(res3b.currentStreak === 1,
  'WEEKDAYS-03b: Friday check-in remains active on Saturday',
  JSON.stringify(res3b));

// Reference date on Monday Sept 21 BEFORE checking in on Monday (Friday keeps streak active)
const res3c = calculateWeekdaysStreak([mockCheckin('1', '2026-09-18T10:00:00')], new Date('2026-09-21T09:00:00'));
assert(res3c.currentStreak === 1,
  'WEEKDAYS-03c: Friday check-in remains active on Monday morning before check-in',
  JSON.stringify(res3c));

// Full 5 days week 1 + Monday of week 2:
const tc3d = [
  mockCheckin('1', '2026-09-14T10:00:00'),
  mockCheckin('2', '2026-09-15T10:00:00'),
  mockCheckin('3', '2026-09-16T10:00:00'),
  mockCheckin('4', '2026-09-17T10:00:00'),
  mockCheckin('5', '2026-09-18T10:00:00'), // Fri
  mockCheckin('6', '2026-09-21T10:00:00'), // Mon
];
const res3d = calculateWeekdaysStreak(tc3d, new Date('2026-09-21T12:00:00'));
assert(res3d.currentStreak === 6 && res3d.longestStreak === 6,
  'WEEKDAYS-03d: Mon-Fri followed by Mon produces streak 6 crossing weekend',
  JSON.stringify(res3d));

// 4. Monday → Wednesday (Tuesday missed)
// Monday Sept 14 and Wednesday Sept 16. Ref: Wednesday Sept 16.
const tc4 = [
  mockCheckin('1', '2026-09-14T10:00:00'),
  mockCheckin('2', '2026-09-16T10:00:00'),
];
const res4 = calculateWeekdaysStreak(tc4, new Date('2026-09-16T12:00:00'));
assert(res4.currentStreak === 1 && res4.longestStreak === 1,
  'WEEKDAYS-04: Monday -> Wednesday (Tuesday missed) resets streak to 1',
  JSON.stringify(res4));

// 5. Friday missed → following Monday
// Thursday Sept 17 approved, Friday Sept 18 missed, Monday Sept 21 approved. Ref: Monday Sept 21.
const tc5 = [
  mockCheckin('1', '2026-09-17T10:00:00'),
  mockCheckin('2', '2026-09-21T10:00:00'),
];
const res5 = calculateWeekdaysStreak(tc5, new Date('2026-09-21T12:00:00'));
assert(res5.currentStreak === 1 && res5.longestStreak === 1,
  'WEEKDAYS-05: Friday missed -> following Monday starts new streak of 1',
  JSON.stringify(res5));

// 6. Month boundary
// Friday July 31, 2026 to Monday August 3, 2026. Ref: Monday August 3.
const tc6 = [
  mockCheckin('1', '2026-07-31T10:00:00'), // Fri
  mockCheckin('2', '2026-08-03T10:00:00'), // Mon
];
const res6 = calculateWeekdaysStreak(tc6, new Date('2026-08-03T12:00:00'));
assert(res6.currentStreak === 2 && res6.longestStreak === 2,
  'WEEKDAYS-06: Month boundary Friday July 31 -> Monday Aug 3 is consecutive (streak 2)',
  JSON.stringify(res6));

// 7. December → January across years
// Thursday Dec 31, 2026 to Friday Jan 1, 2027. Ref: Friday Jan 1, 2027.
const tc7 = [
  mockCheckin('1', '2026-12-31T10:00:00'), // Thu
  mockCheckin('2', '2027-01-01T10:00:00'), // Fri
];
const res7 = calculateWeekdaysStreak(tc7, new Date('2027-01-01T12:00:00'));
assert(res7.currentStreak === 2 && res7.longestStreak === 2,
  'WEEKDAYS-07: Year boundary Thu Dec 31 -> Fri Jan 1 is consecutive (streak 2)',
  JSON.stringify(res7));

// 8. Multiple check-ins on same weekday
const tc8 = [
  mockCheckin('1', '2026-09-18T09:00:00'),
  mockCheckin('2', '2026-09-18T14:00:00'),
  mockCheckin('3', '2026-09-18T18:00:00'),
];
const res8 = calculateWeekdaysStreak(tc8, new Date('2026-09-18T20:00:00'));
assert(res8.totalApprovedDays === 1 && res8.currentStreak === 1 && res8.longestStreak === 1,
  'WEEKDAYS-08: Multiple check-ins on same weekday count as 1 completed weekday',
  JSON.stringify(res8));

// 9. Monthly: January → February → March
const tc9 = [
  mockCheckin('1', '2026-01-15T10:00:00'),
  mockCheckin('2', '2026-02-15T10:00:00'),
  mockCheckin('3', '2026-03-15T10:00:00'),
];
const res9 = calculateMonthlyStreak(tc9, new Date('2026-03-20T12:00:00'));
assert(res9.currentStreak === 3 && res9.longestStreak === 3 && res9.totalApprovedDays === 3,
  'MONTHLY-09: Jan -> Feb -> March produces streak 3',
  JSON.stringify(res9));

// 10. Monthly: January → March (February missed)
const tc10 = [
  mockCheckin('1', '2026-01-15T10:00:00'),
  mockCheckin('2', '2026-03-15T10:00:00'),
];
const res10 = calculateMonthlyStreak(tc10, new Date('2026-03-20T12:00:00'));
assert(res10.currentStreak === 1 && res10.longestStreak === 1,
  'MONTHLY-10: Jan -> March (Feb missed) produces currentStreak 1, longestStreak 1',
  JSON.stringify(res10));

// 11. Monthly: December → January across years
const tc11 = [
  mockCheckin('1', '2026-12-15T10:00:00'),
  mockCheckin('2', '2027-01-10T10:00:00'),
];
const res11 = calculateMonthlyStreak(tc11, new Date('2027-01-15T12:00:00'));
assert(res11.currentStreak === 2 && res11.longestStreak === 2,
  'MONTHLY-11: Dec 2026 -> Jan 2027 across year boundary is consecutive (streak 2)',
  JSON.stringify(res11));

// 12. Monthly: Multiple approved check-ins in one month
const tc12 = [
  mockCheckin('1', '2026-01-02T10:00:00'),
  mockCheckin('2', '2026-01-10T10:00:00'),
  mockCheckin('3', '2026-01-20T10:00:00'),
  mockCheckin('4', '2026-01-25T10:00:00'),
  mockCheckin('5', '2026-01-30T10:00:00'),
  mockCheckin('6', '2026-02-05T10:00:00'),
  mockCheckin('7', '2026-02-12T10:00:00'),
  mockCheckin('8', '2026-02-20T10:00:00'),
];
const res12 = calculateMonthlyStreak(tc12, new Date('2026-02-28T12:00:00'));
assert(res12.totalApprovedDays === 2 && res12.currentStreak === 2 && res12.longestStreak === 2,
  'MONTHLY-12: 5 Jan check-ins + 3 Feb check-ins count as 2 completed months',
  JSON.stringify(res12));

// 13. Monthly: Current month with no approval, but previous month approved
// Today = Sept 20, August approved, Sept has no approved checkin -> streak = 1 (active)
const tc13 = [mockCheckin('1', '2026-08-15T10:00:00')];
const res13 = calculateMonthlyStreak(tc13, new Date('2026-09-20T12:00:00'));
assert(res13.currentStreak === 1,
  'MONTHLY-13: Previous month completed keeps monthly streak active in current month (streak 1)',
  JSON.stringify(res13));

// 14. Monthly: July and August approved, Sept has no approval (Today Sept 20)
const tc14 = [
  mockCheckin('1', '2026-07-15T10:00:00'),
  mockCheckin('2', '2026-08-15T10:00:00'),
];
const res14 = calculateMonthlyStreak(tc14, new Date('2026-09-20T12:00:00'));
assert(res14.currentStreak === 2 && res14.longestStreak === 2,
  'MONTHLY-14: July + Aug approved, Sept pending produces currentStreak 2',
  JSON.stringify(res14));

// 15. Monthly: Two-month gap (June + July approved, August and September no approval, Today Sept 20)
const tc15 = [
  mockCheckin('1', '2026-06-15T10:00:00'),
  mockCheckin('2', '2026-07-15T10:00:00'),
];
const res15 = calculateMonthlyStreak(tc15, new Date('2026-09-20T12:00:00'));
assert(res15.currentStreak === 0 && res15.longestStreak === 2,
  'MONTHLY-15: Two-month gap causes currentStreak to drop to 0, longestStreak remains 2',
  JSON.stringify(res15));

// 16. Daily streak regression
const tc16 = [
  mockCheckin('1', '2026-09-17T10:00:00'),
  mockCheckin('2', '2026-09-18T10:00:00'),
  mockCheckin('3', '2026-09-19T10:00:00'),
];
const res16 = calculateDailyStreak(tc16, new Date('2026-09-20T12:00:00'));
assert(res16.currentStreak === 3 && res16.longestStreak === 3 && res16.totalApprovedDays === 3,
  'REGRESSION-16: Daily streak correctly evaluates to 3 when completed yesterday',
  JSON.stringify(res16));

// 17. Weekly streak regression
const tc17 = [
  mockCheckin('1', '2026-09-08T10:00:00'), // Week 37
  mockCheckin('2', '2026-09-15T10:00:00'), // Week 38
];
const res17 = calculateWeeklyStreak(tc17, new Date('2026-09-20T12:00:00'));
assert(res17.currentStreak === 2 && res17.longestStreak === 2,
  'REGRESSION-17: Weekly streak calculates consecutive calendar weeks correctly',
  JSON.stringify(res17));

// 18. Custom streak regression
const tc18 = [
  mockCheckin('1', '2026-09-10T10:00:00'),
  mockCheckin('2', '2026-09-12T10:00:00'),
  mockCheckin('3', '2026-09-14T10:00:00'),
];
const approvedIds18 = new Set(['1', '2', '3']);
const res18 = calculateCustomStreak(tc18, approvedIds18);
assert(res18.currentStreak === 3 && res18.longestStreak === 3,
  'REGRESSION-18: Custom streak evaluates consecutive event count',
  JSON.stringify(res18));

console.log('------------------------------------------------------------------------');
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('------------------------------------------------------------------------');

if (failed > 0) {
  process.exit(1);
}
