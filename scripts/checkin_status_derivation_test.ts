/**
 * SANKALPA — CHECK-IN STATUS DERIVATION TEST SUITE
 *
 * Verifies that the human-readable check-in state displayed in Check-in History
 * is derived strictly and dynamically from witness actions and witnessing relationships,
 * while leaving checkins.status and firestore.rules untouched:
 *
 * TEST SPECIFICATION:
 * A. Create a new check-in.
 *    Expected: "Awaiting witness" if witnessing applies.
 * B. Approve it as an accepted witness.
 *    Expected: "Approved" without refreshing.
 * C. Create another check-in and use "Ask for more".
 *    Expected: "More evidence requested".
 * D. Create another check-in and flag it.
 *    Expected: "Flagged".
 * E. A check-in with no witness relationship:
 *    Expected: "Recorded".
 * F. Phase 8 Multi-witness Independence & Precedence:
 *    - At least one approved action -> "Approved"
 *    - Latest non-approval action takes precedence between flagged and asked_for_more
 * G. Verification that checkins.status schema and security rules were preserved.
 */

import { deriveCheckinDisplayStatus } from '../src/utils/checkinStatusUtils.ts';
import type { WitnessAction } from '../src/types/index.ts';
import * as fs from 'fs';
import * as path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`[PASS] ${testName}`);
  } else {
    failed++;
    console.error(`[FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
  }
}

console.log('========================================================================');
console.log('SANKALPA: CHECK-IN STATUS UI DERIVATION TEST SUITE');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// TEST A: New check-in with witnessing relationship (no witness actions yet)
// -----------------------------------------------------------------------------
console.log('--- TEST A: New Check-in with Witnessing Relationship ---');

const checkinA_noActions: WitnessAction[] = [];
const resultA = deriveCheckinDisplayStatus(checkinA_noActions, true);

assert(
  resultA.status === 'Awaiting witness',
  'TEST A: When witnessing applies and no witness response exists -> "Awaiting witness"'
);
assert(
  resultA.badgeStyle.includes('text-neutral-600'),
  'TEST A.1: Badge style is calm neutral'
);

// -----------------------------------------------------------------------------
// TEST B: Approved by an accepted witness
// -----------------------------------------------------------------------------
console.log('\n--- TEST B: Approved by an Accepted Witness ---');

const checkinB_approved: WitnessAction[] = [
  {
    id: 'act-1',
    checkinId: 'chk-1',
    witnessId: 'witness-1',
    responseType: 'approved',
    timestamp: new Date('2026-09-21T10:00:00Z'),
    note: 'Great practice!',
  },
];
const resultB = deriveCheckinDisplayStatus(checkinB_approved, true);

assert(
  resultB.status === 'Approved',
  'TEST B: When at least one witness action has responseType === "approved" -> "Approved"'
);
assert(
  resultB.badgeStyle.includes('#3F7D5C'),
  'TEST B.1: Approved badge uses Sankalpa sage green (#3F7D5C)'
);

// -----------------------------------------------------------------------------
// TEST C: Witness responded "Ask for more"
// -----------------------------------------------------------------------------
console.log('\n--- TEST C: Witness Responded "Ask for more" ---');

const checkinC_askedForMore: WitnessAction[] = [
  {
    id: 'act-2',
    checkinId: 'chk-2',
    witnessId: 'witness-1',
    responseType: 'asked_for_more',
    timestamp: new Date('2026-09-21T11:00:00Z'),
    note: 'Could you share photo evidence of your mat?',
  },
];
const resultC = deriveCheckinDisplayStatus(checkinC_askedForMore, true);

assert(
  resultC.status === 'More evidence requested',
  'TEST C: When no approval exists and response is asked_for_more -> "More evidence requested"'
);
assert(
  resultC.badgeStyle.includes('amber'),
  'TEST C.1: More evidence badge uses calm warm amber styling'
);

// -----------------------------------------------------------------------------
// TEST D: Witness responded "Flagged"
// -----------------------------------------------------------------------------
console.log('\n--- TEST D: Witness Responded "Flagged" ---');

const checkinD_flagged: WitnessAction[] = [
  {
    id: 'act-3',
    checkinId: 'chk-3',
    witnessId: 'witness-1',
    responseType: 'flagged',
    timestamp: new Date('2026-09-21T12:00:00Z'),
    note: 'Timestamp does not match commitment schedule.',
  },
];
const resultD = deriveCheckinDisplayStatus(checkinD_flagged, true);

assert(
  resultD.status === 'Flagged',
  'TEST D: When witness response is flagged -> "Flagged"'
);
assert(
  resultD.badgeStyle.includes('#C26D55'),
  'TEST D.1: Flagged badge uses Sankalpa terracotta (#C26D55)'
);

// -----------------------------------------------------------------------------
// TEST E: Check-in with NO witness relationship
// -----------------------------------------------------------------------------
console.log('\n--- TEST E: Check-in with No Witness Relationship ---');

const checkinE_noWitness: WitnessAction[] = [];
const resultE = deriveCheckinDisplayStatus(checkinE_noWitness, false);

assert(
  resultE.status === 'Recorded',
  'TEST E: When commitment has no witnessing relationship and no response -> "Recorded"'
);
assert(
  resultE.badgeStyle.includes('text-neutral-600'),
  'TEST E.1: Recorded badge uses neutral styling'
);

// -----------------------------------------------------------------------------
// TEST F: Phase 8 Multi-Witness Semantics & Precedence
// -----------------------------------------------------------------------------
console.log('\n--- TEST F: Phase 8 Multi-Witness Semantics & Precedence ---');

// F1: One witness flags, another approves
const multiF1: WitnessAction[] = [
  {
    id: 'act-f1a',
    checkinId: 'chk-f1',
    witnessId: 'witness-1',
    responseType: 'flagged',
    timestamp: new Date('2026-09-21T10:00:00Z'),
  },
  {
    id: 'act-f1b',
    checkinId: 'chk-f1',
    witnessId: 'witness-2',
    responseType: 'approved',
    timestamp: new Date('2026-09-21T10:05:00Z'),
  },
];
const resultF1 = deriveCheckinDisplayStatus(multiF1, true);
assert(
  resultF1.status === 'Approved',
  'TEST F.1: Multiple witnesses - if at least one approved, status is always "Approved"'
);

// F2: Witness 1 asked for more, then later flagged
const multiF2: WitnessAction[] = [
  {
    id: 'act-f2a',
    checkinId: 'chk-f2',
    witnessId: 'witness-1',
    responseType: 'asked_for_more',
    timestamp: new Date('2026-09-21T10:00:00Z'),
  },
  {
    id: 'act-f2b',
    checkinId: 'chk-f2',
    witnessId: 'witness-1',
    responseType: 'flagged',
    timestamp: new Date('2026-09-21T10:30:00Z'), // latest
  },
];
const resultF2 = deriveCheckinDisplayStatus(multiF2, true);
assert(
  resultF2.status === 'Flagged',
  'TEST F.2: Latest non-approval action is flagged -> "Flagged"'
);

// F3: Witness 1 flagged, then later requested more evidence
const multiF3: WitnessAction[] = [
  {
    id: 'act-f3a',
    checkinId: 'chk-f3',
    witnessId: 'witness-1',
    responseType: 'flagged',
    timestamp: new Date('2026-09-21T10:00:00Z'),
  },
  {
    id: 'act-f3b',
    checkinId: 'chk-f3',
    witnessId: 'witness-1',
    responseType: 'asked_for_more',
    timestamp: new Date('2026-09-21T10:30:00Z'), // latest
  },
];
const resultF3 = deriveCheckinDisplayStatus(multiF3, true);
assert(
  resultF3.status === 'More evidence requested',
  'TEST F.3: Latest non-approval action is asked_for_more -> "More evidence requested"'
);

// -----------------------------------------------------------------------------
// TEST G: Architectural & Security Rule Invariance
// -----------------------------------------------------------------------------
console.log('\n--- TEST G: Architecture & Security Rules Invariance ---');

const rulesContent = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');

// Check that checkins.status schema rules were NOT modified
assert(
  rulesContent.includes("incoming().status == 'pending'"),
  'TEST G.1: Firestore rules continue to enforce incoming checkins.status == "pending"'
);

assert(
  rulesContent.includes('match /witnessActions/{actionId}'),
  'TEST G.2: witnessActions collection security rules are preserved'
);

assert(
  rulesContent.includes("data.responseType in ['approved', 'asked_for_more', 'flagged'"),
  'TEST G.3: Allowed witness response types remain strictly enforced in rules'
);

// Check that CheckinHistory does NOT mutate checkins.status
const checkinHistoryContent = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/checkins/CheckinHistory.tsx'),
  'utf-8'
);

assert(
  !checkinHistoryContent.includes('updateDoc') &&
  !checkinHistoryContent.includes('setDoc'),
  'TEST G.4: CheckinHistory is strictly read-only and never writes or mutates checkins'
);

assert(
  checkinHistoryContent.includes('deriveCheckinDisplayStatus'),
  'TEST G.5: CheckinHistory derives human-readable state via deriveCheckinDisplayStatus'
);

// Check that useCheckinApprovals re-exports deriveCheckinDisplayStatus
const approvalsHookContent = fs.readFileSync(
  path.resolve(process.cwd(), 'src/hooks/useCheckinApprovals.ts'),
  'utf-8'
);
assert(
  approvalsHookContent.includes('deriveCheckinDisplayStatus'),
  'TEST G.6: useCheckinApprovals integrates and exports deriveCheckinDisplayStatus'
);

console.log('\n========================================================================');
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
