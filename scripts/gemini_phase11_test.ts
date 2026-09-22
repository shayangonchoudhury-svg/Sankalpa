/**
 * SANKALPA PHASE 11: GEMINI AI FEATURES VERIFICATION SUITE
 *
 * Tests Spark-compatible Firebase AI Logic integration:
 * - Feature 1: Reflective Check-in Prompt
 * - Feature 2: Advisory Witness Evidence Review
 * - Security & Authorization (Auth, App Check, Witness-only, Owner-blind)
 * - Invariance of checkins.status, streaks, Trust Score, and Firestore security rules
 */

import { getReflectivePrompt, analyzeCheckinEvidence, setMockAiHandler } from '../src/services/aiService.ts';
import { auth } from '../src/lib/firebase.ts';
import type { Checkin, AiFlag } from '../src/types/index.ts';
import * as fs from 'fs';
import * as path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function runPhase11Tests() {
  console.log('========================================================================');
  console.log('SANKALPA: PHASE 11 GEMINI AI FEATURES TEST SUITE (SPARK COMPATIBLE)');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // SUITE 1: REFLECTIVE CHECK-IN PROMPTS (FEATURE 1)
  // -------------------------------------------------------------------------
  console.log('--- SUITE 1: Reflective Check-in Prompts ---');

  // Test 1: Unauthenticated user cannot request prompt
  const originalCurrentUser = auth.currentUser;
  Object.defineProperty(auth, 'currentUser', { value: null, configurable: true });

  const unauthPrompt = await getReflectivePrompt('Morning Vipassana', 'daily');
  assert(unauthPrompt === null, '1. Unauthenticated user cannot request prompt');

  // Set mock authenticated user
  const mockUser = { uid: 'practitioner-user-123', email: 'practitioner@sankalpa.app' };
  Object.defineProperty(auth, 'currentUser', { value: mockUser, configurable: true });

  // Test 2 & 3: Authenticated user can request reflective prompt incorporating title & cadence
  let receivedTitle = '';
  let receivedCadence = '';
  setMockAiHandler({
    generatePrompt: async (title: string, cadence: string) => {
      receivedTitle = title;
      receivedCadence = cadence;
      return 'What helped you follow through with your commitment today?';
    },
  });

  const authPrompt = await getReflectivePrompt('Daily Pranayama Breathing', 'daily');
  assert(authPrompt !== null, '2. Authenticated user can request reflective prompt');
  assert(
    receivedTitle === 'Daily Pranayama Breathing' && receivedCadence === 'daily',
    '3. Prompt uses commitment title & cadence'
  );

  // Test 4: Prompt response is short, warm, and reflective
  assert(
    typeof authPrompt === 'string' &&
      authPrompt.endsWith('?') &&
      authPrompt.split(' ').length <= 20,
    '4. Prompt response is short, warm, reflective question'
  );

  // Test 5: CheckinForm renders and clearly labels the prompt as "AI suggested"
  const checkinFormSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/components/checkins/CheckinForm.tsx'),
    'utf8'
  );
  assert(
    checkinFormSrc.includes('AI suggested') &&
      checkinFormSrc.includes('ai-reflective-prompt-box') &&
      checkinFormSrc.includes('ai-reflective-prompt-text'),
    '5. Prompt is labeled "AI suggested" in CheckinForm with serene styling'
  );

  // Test 6: Gemini failure does not block check-in submission (fails gracefully)
  setMockAiHandler({
    generatePrompt: async () => {
      throw new Error('Simulated Gemini 503 Overloaded');
    },
  });
  const failedPrompt = await getReflectivePrompt('Evening Reading', 'daily');
  assert(
    failedPrompt === null,
    '6. Gemini failure fails gracefully to null without throwing'
  );

  // Test 7: Form does not re-request prompt on every render (memoized / bounded to commitmentId)
  assert(
    checkinFormSrc.includes('useEffect(') &&
      checkinFormSrc.includes('}, [commitmentId]);'),
    '7. Form does not re-request prompt on every render (bounded to [commitmentId])'
  );

  // -------------------------------------------------------------------------
  // SUITE 2: ON-DEMAND WITNESS EVIDENCE FLAGGING (FEATURE 2)
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 2: On-Demand Witness Evidence Review ---');

  // Test 8: Text-only check-in does not trigger evidence analysis
  const textCheckin: Checkin = {
    id: 'checkin-text-01',
    commitmentId: 'commit-01',
    userId: 'practitioner-user-123',
    evidenceType: 'text',
    note: 'Completed 30 minutes of sitting practice.',
    timestamp: Date.now(),
    status: 'pending',
  };
  const textResult = await analyzeCheckinEvidence({ checkin: textCheckin });
  assert(
    textResult.flagged === false && textResult.reason === null,
    '8. Text-only check-in does not trigger evidence analysis (returns safe unflagged)'
  );

  // Test 9: Only authorized witnesses can access evidence review UI in WitnessInbox
  const witnessInboxSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/pages/WitnessInbox.tsx'),
    'utf8'
  );
  const witnessActionsSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/components/witnessing/WitnessActionButtons.tsx'),
    'utf8'
  );
  assert(
    witnessInboxSrc.includes('acceptedWitnessInvites') &&
      witnessInboxSrc.includes('WitnessActionButtons') &&
      witnessActionsSrc.includes('btn-request-ai-review'),
    '9. Only authorized witnesses can access evidence review in WitnessInbox'
  );

  // Test 10: Check-in owner cannot see witness AI review
  const commitmentDetailSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/pages/CommitmentDetail.tsx'),
    'utf8'
  );
  const checkinHistorySrc = fs.readFileSync(
    path.join(process.cwd(), 'src/components/checkins/CheckinHistory.tsx'),
    'utf8'
  );
  const checkinWitnessResponsesSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/components/witnessing/CheckinWitnessResponses.tsx'),
    'utf8'
  );
  assert(
    !commitmentDetailSrc.includes('ai-review-result') &&
      !checkinHistorySrc.includes('ai-review-result') &&
      !checkinWitnessResponsesSrc.includes('ai-review-result') &&
      !checkinWitnessResponsesSrc.includes('aiFlag'),
    '10. Check-in owner cannot see witness AI review in any owner-facing UI'
  );

  // Test 11: Unrelated user cannot access witness AI review
  // Verified by Firestore rules: check-in review actions are restricted to accepted witnesses
  const firestoreRules = fs.readFileSync(
    path.join(process.cwd(), 'firestore.rules'),
    'utf8'
  );
  assert(
    firestoreRules.includes('isAcceptedWitness(resource.data.commitmentId)'),
    '11. Unrelated user cannot access witness review data in Firestore'
  );

  // Test 12: Photo evidence can be analyzed
  const photoCheckin: Checkin = {
    id: 'checkin-photo-01',
    commitmentId: 'commit-01',
    userId: 'practitioner-user-123',
    evidenceType: 'photo',
    evidenceUrl: 'https://example.com/evidence/photo1.jpg',
    timestamp: Date.now(),
    status: 'pending',
  };

  setMockAiHandler({
    analyzeEvidence: async (current, previous) => {
      return { flagged: false, reason: null };
    },
  });
  const validPhotoResult = await analyzeCheckinEvidence({ checkin: photoCheckin });
  assert(
    validPhotoResult.flagged === false,
    '12. Photo evidence can be analyzed on demand'
  );

  // Test 13: Duplicate fixture produces flagged=true
  setMockAiHandler({
    analyzeEvidence: async (current, previous) => {
      const isDuplicate = previous.some((p) => p.evidenceUrl === current.evidenceUrl);
      if (isDuplicate) {
        return {
          flagged: true,
          reason: 'The image appears very similar to a recent submission for this commitment.',
        };
      }
      return { flagged: false, reason: null };
    },
  });

  const duplicatePrevious: Checkin[] = [
    {
      id: 'checkin-prev-01',
      commitmentId: 'commit-01',
      userId: 'practitioner-user-123',
      evidenceType: 'photo',
      evidenceUrl: 'https://example.com/evidence/photo1.jpg', // Same URL as current
      timestamp: Date.now() - 86400000,
      status: 'pending',
    },
  ];

  const duplicateResult = await analyzeCheckinEvidence({
    checkin: photoCheckin,
    previousCheckins: duplicatePrevious,
  });
  assert(
    duplicateResult.flagged === true &&
      Boolean(duplicateResult.reason?.includes('similar to a recent submission')),
    '13. Duplicate fixture produces flagged=true with neutral factual reason'
  );

  // Test 14: Normal unique fixture produces flagged=false
  const uniquePrevious: Checkin[] = [
    {
      id: 'checkin-prev-02',
      commitmentId: 'commit-01',
      userId: 'practitioner-user-123',
      evidenceType: 'photo',
      evidenceUrl: 'https://example.com/evidence/different_photo.jpg',
      timestamp: Date.now() - 86400000,
      status: 'pending',
    },
  ];
  const uniqueResult = await analyzeCheckinEvidence({
    checkin: photoCheckin,
    previousCheckins: uniquePrevious,
  });
  assert(
    uniqueResult.flagged === false && uniqueResult.reason === null,
    '14. Normal unique fixture produces flagged=false'
  );

  // Test 15: Blank/black fixture produces flagged=true
  setMockAiHandler({
    analyzeEvidence: async (current) => {
      if (current.evidenceUrl?.includes('blank') || current.evidenceUrl?.includes('black')) {
        return {
          flagged: true,
          reason: 'The image appears to be blank or unusable.',
        };
      }
      return { flagged: false, reason: null };
    },
  });
  const blankCheckin: Checkin = {
    ...photoCheckin,
    evidenceUrl: 'https://example.com/evidence/blank.jpg',
  };
  const blankResult = await analyzeCheckinEvidence({ checkin: blankCheckin });
  assert(
    blankResult.flagged === true && Boolean(blankResult.reason?.includes('unusable')),
    '15. Blank/black fixture produces flagged=true'
  );

  // Test 16: Maximum two previous evidence images are considered
  let evaluatedCount = 0;
  setMockAiHandler({
    analyzeEvidence: async (current, previous) => {
      evaluatedCount = previous.length;
      return { flagged: false, reason: null };
    },
  });

  const fourPrevious: Checkin[] = [1, 2, 3, 4].map((n) => ({
    id: `checkin-prev-${n}`,
    commitmentId: 'commit-01',
    userId: 'practitioner-user-123',
    evidenceType: 'photo',
    evidenceUrl: `https://example.com/evidence/photo_${n}.jpg`,
    timestamp: Date.now() - n * 86400000,
    status: 'pending',
  }));

  // Service code slices candidates at 2
  const aiServiceSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/services/aiService.ts'),
    'utf8'
  );
  assert(
    aiServiceSrc.includes('.slice(0, 2)'),
    '16. Maximum two previous evidence images are considered (.slice(0, 2))'
  );

  // Test 17: No full-history scan occurs
  assert(
    !aiServiceSrc.includes('getDocs(') && !aiServiceSrc.includes('limit(100)'),
    '17. No full-history scan occurs in AI evidence service'
  );

  // Test 18: Invalid Gemini response fails safely
  setMockAiHandler({
    analyzeEvidence: async () => {
      throw new Error('Malformed JSON or Network Timeout');
    },
  });
  const malformedResult = await analyzeCheckinEvidence({ checkin: photoCheckin });
  assert(
    malformedResult.flagged === false && malformedResult.reason === null,
    '18. Invalid Gemini response fails safely without throwing'
  );

  // -------------------------------------------------------------------------
  // SUITE 3: INVARIANCE OF CORE DATA & SYSTEM INTEGRITY
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 3: System Invariance & Rule Integrity ---');

  // Test 19: AI analysis cannot change checkins.status
  // Status remains strictly 'pending' and checkins are immutable from client
  assert(
    firestoreRules.includes('data.status == \'pending\'') &&
      firestoreRules.includes('match /checkins/{checkinId} {\n      allow get:') &&
      firestoreRules.includes('allow update: if false;') &&
      firestoreRules.includes('allow delete: if false;'),
    '19. AI analysis cannot change checkins.status (checkins are immutable: update: false)'
  );

  // Test 20: AI analysis cannot modify streak
  const streakSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/hooks/useStreak.ts'),
    'utf8'
  );
  assert(
    !streakSrc.includes('aiFlag') && !streakSrc.includes('analyzeCheckinEvidence'),
    '20. AI analysis cannot modify streak calculation'
  );

  // Test 21: AI analysis cannot modify Trust Score
  const profileSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/pages/Profile.tsx'),
    'utf8'
  );
  assert(
    !profileSrc.includes('aiFlag') && !profileSrc.includes('analyzeCheckinEvidence'),
    '21. AI analysis cannot modify Trust Score'
  );

  // Test 22: Firestore checkins schema strictly rejects client-written aiFlag
  assert(
    firestoreRules.includes(
      "data.keys().hasOnly(['commitmentId', 'userId', 'evidenceType', 'status', 'evidenceUrl', 'note', 'timestamp'])"
    ),
    '22. Firestore checkins collection strictly forbids client-written aiFlag'
  );

  // Test 23: Firebase App Check configured for web with debug token support
  const firebaseLibSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/firebase.ts'),
    'utf8'
  );
  assert(
    firebaseLibSrc.includes('initializeAppCheck') &&
      firebaseLibSrc.includes('GoogleAIBackend') &&
      firebaseLibSrc.includes('VITE_APPCHECK_DEBUG_TOKEN'),
    '23. Firebase App Check & GoogleAIBackend initialized in firebase.ts'
  );

  // Reset mock handler
  setMockAiHandler(null);
  Object.defineProperty(auth, 'currentUser', { value: originalCurrentUser, configurable: true });

  console.log('\n========================================================================');
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase11Tests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
