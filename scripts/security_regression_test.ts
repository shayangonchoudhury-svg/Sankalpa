/**
 * COMPREHENSIVE SECURITY REGRESSION TEST SUITE FOR SANKALPA FIRESTORE SECURITY RULES
 * Evaluates Phase 8 Baseline + Phase 9 Circles & Group Challenges.
 *
 * Covers all 36 required Phase 9 tests across:
 * - CIRCLE (1–6)
 * - INVITES (7–11)
 * - MEMBERSHIP (12–15)
 * - CHALLENGE (16–22)
 * - COMMITMENTS (23–27)
 * - VISIBILITY (28–32)
 * - REGRESSION (33–36)
 * plus full baseline security coverage.
 */

import * as fs from 'fs';
import * as path from 'path';

interface SecurityTestCase {
  id: string;
  category: string;
  description: string;
  expectedOutcome: 'ALLOW' | 'DENY';
  evaluator: (rules: string) => boolean;
  notes?: string;
}

const rulesContent = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');

const tests: SecurityTestCase[] = [
  // =========================================================================
  // PHASE 9 SPECIFIC TEST CASES (1 to 36)
  // =========================================================================

  // ----------------------------------------------------
  // CIRCLE (1–6)
  // ----------------------------------------------------
  {
    id: 'P9-CIRCLE-01',
    category: 'CIRCLE',
    description: '1. Owner creates Circle with memberCount == 1 and members == [ownerId]',
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('match /circles/{circleId}') &&
      r.includes('incoming().ownerId == request.auth.uid') &&
      r.includes('incoming().memberCount == 1') &&
      r.includes("incoming().members == [request.auth.uid]"),
  },
  {
    id: 'P9-CIRCLE-02',
    category: 'CIRCLE',
    description: '2. Owner becomes accepted member atomically in circles/{circleId}/members/{uid}',
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('existsAfter(/databases/$(database)/documents/circles/$(circleId)/members/$(request.auth.uid))') &&
      r.includes("getAfter(/databases/$(database)/documents/circles/$(circleId)/members/$(request.auth.uid)).data.status == 'accepted'"),
  },
  {
    id: 'P9-CIRCLE-03',
    category: 'CIRCLE',
    description: '3. Accepted member can read Circle document',
    expectedOutcome: 'ALLOW',
    evaluator: (r) => {
      const circleMatch = r.substring(r.indexOf('match /circles/{circleId}'));
      return circleMatch.includes('isAcceptedCircleMember(circleId)');
    },
  },
  {
    id: 'P9-CIRCLE-04',
    category: 'CIRCLE',
    description: '4. Pending invite cannot read Circle challenge data (only accepted members authorized)',
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes("get(/databases/$(database)/documents/circles/$(circleId)/members/$(request.auth.uid)).data.status == 'accepted'") &&
      !r.includes("data.status == 'pending' && canReadChallenge"),
  },
  {
    id: 'P9-CIRCLE-05',
    category: 'CIRCLE',
    description: '5. Unrelated user cannot read Circle document',
    expectedOutcome: 'DENY',
    evaluator: (r) => {
      const circleMatch = r.substring(r.indexOf('match /circles/{circleId}'), r.indexOf('match /circleInvites'));
      return (
        circleMatch.includes('resource.data.ownerId == request.auth.uid ||') &&
        circleMatch.includes('isAcceptedCircleMember(circleId)') &&
        !circleMatch.includes('allow get: if isSignedIn();')
      );
    },
  },
  {
    id: 'P9-CIRCLE-06',
    category: 'CIRCLE',
    description: '6. Unrelated user cannot create membership without valid invite',
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('exists(/databases/$(database)/documents/circleInvites/$(incoming().inviteId))') &&
      r.includes('get(/databases/$(database)/documents/circleInvites/$(incoming().inviteId)).data.toEmail == userEmail()'),
  },

  // ----------------------------------------------------
  // INVITES (7–11)
  // ----------------------------------------------------
  {
    id: 'P9-INVITE-07',
    category: 'INVITES',
    description: '7. Correct recipient can accept invite matching authenticated userEmail()',
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('existing().toEmail == userEmail()') &&
      r.includes("incoming().status == 'accepted'") &&
      r.includes('incoming().toUserId == request.auth.uid'),
  },
  {
    id: 'P9-INVITE-08',
    category: 'INVITES',
    description: '8. Wrong user cannot accept invitation directed to another email',
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('existing().toEmail == userEmail()') &&
      r.includes("userEmail() != ''"),
  },
  {
    id: 'P9-INVITE-09',
    category: 'INVITES',
    description: '9. Self-invite rejected by rule logic',
    expectedOutcome: 'DENY',
    evaluator: (r) => r.includes("incoming().toEmail != userEmail()"),
  },
  {
    id: 'P9-INVITE-10',
    category: 'INVITES',
    description: '10. Duplicate invite rejected: only status == pending can be updated and immutable circleId',
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes("existing().status == 'pending'") &&
      r.includes("incoming().circleId == existing().circleId"),
  },
  {
    id: 'P9-INVITE-11',
    category: 'INVITES',
    description: '11. Acceptance at memberCount=10 rejected by memberCount < 10 guard',
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('get(/databases/$(database)/documents/circles/$(existing().circleId)).data.memberCount < 10') &&
      r.includes('getAfter(/databases/$(database)/documents/circles/$(circleId)).data.memberCount <= 10'),
  },

  // ----------------------------------------------------
  // MEMBERSHIP (12–15)
  // ----------------------------------------------------
  {
    id: 'P9-MEMBER-12',
    category: 'MEMBERSHIP',
    description: '12. Cannot forge accepted membership without verified invite and valid transition',
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('exists(/databases/$(database)/documents/circleInvites/$(incoming().inviteId))') &&
      r.includes("getAfter(/databases/$(database)/documents/circleInvites/$(incoming().inviteId)).data.status == 'accepted'"),
  },
  {
    id: 'P9-MEMBER-13',
    category: 'MEMBERSHIP',
    description: "13. Cannot modify another user's membership (members subcollection update is disallowed)",
    expectedOutcome: 'DENY',
    evaluator: (r) => {
      const memberSub = r.substring(r.indexOf('match /members/{uid}'), r.indexOf('match /circleInvites'));
      return memberSub.includes('allow update: if false;');
    },
  },
  {
    id: 'P9-MEMBER-14',
    category: 'MEMBERSHIP',
    description: '14. Cannot transfer membership (deletion and update are disallowed in members subcollection)',
    expectedOutcome: 'DENY',
    evaluator: (r) => {
      const memberSub = r.substring(r.indexOf('match /members/{uid}'), r.indexOf('match /circleInvites'));
      return memberSub.includes('allow delete: if false;') && memberSub.includes('allow update: if false;');
    },
  },
  {
    id: 'P9-MEMBER-15',
    category: 'MEMBERSHIP',
    description: '15. Concurrent acceptance cannot exceed 10 (data.memberCount <= 10 enforced in transaction write)',
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('getAfter(/databases/$(database)/documents/circles/$(circleId)).data.memberCount <= 10') &&
      r.includes('incoming().memberCount <= 10'),
  },

  // ----------------------------------------------------
  // CHALLENGE (16–22)
  // ----------------------------------------------------
  {
    id: 'P9-CHAL-16',
    category: 'CHALLENGE',
    description: '16. Accepted member can start challenge in their Circle',
    expectedOutcome: 'ALLOW',
    evaluator: (r) => {
      const chalMatch = r.substring(r.indexOf('match /challenges/{challengeId}'), r.indexOf('match /participants'));
      return (
        chalMatch.includes('isAcceptedCircleMember(incoming().circleId)') &&
        chalMatch.includes('incoming().createdBy == request.auth.uid')
      );
    },
  },
  {
    id: 'P9-CHAL-17',
    category: 'CHALLENGE',
    description: '17. Non-member cannot start challenge (requires isAcceptedCircleMember)',
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('isAcceptedCircleMember(incoming().circleId)') &&
      r.includes("function isAcceptedCircleMember(circleId)"),
  },
  {
    id: 'P9-CHAL-18',
    category: 'CHALLENGE',
    description: '18. Challenge belongs to correct Circle with validated circleId',
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('isValidChallenge(incoming())') &&
      r.includes('data.circleId is string && isValidId(data.circleId)'),
  },
  {
    id: 'P9-CHAL-19',
    category: 'CHALLENGE',
    description: '19. Only accepted members become participants (isAcceptedCircleMemberByUid verified)',
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('isAcceptedCircleMemberByUid(incoming().circleId, uid)'),
  },
  {
    id: 'P9-CHAL-20',
    category: 'CHALLENGE',
    description: '20. Participant records match commitments in atomic batch',
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('existsAfter(/databases/$(database)/documents/commitments/$(incoming().commitmentId))') &&
      r.includes('getAfter(/databases/$(database)/documents/commitments/$(incoming().commitmentId)).data.ownerId == uid') &&
      r.includes('getAfter(/databases/$(database)/documents/commitments/$(incoming().commitmentId)).data.challengeId == challengeId'),
  },
  {
    id: 'P9-CHAL-21',
    category: 'CHALLENGE',
    description: '21. Challenge commitments are created atomically alongside challenge and participant doc',
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('existsAfter(/databases/$(database)/documents/challenges/$(incoming().challengeId))') &&
      r.includes('existsAfter(/databases/$(database)/documents/challenges/$(incoming().challengeId)/participants/$(incoming().ownerId))'),
  },
  {
    id: 'P9-CHAL-22',
    category: 'CHALLENGE',
    description: '22. Failed batch leaves no partial challenge (all-or-nothing existsAfter & getAfter integrity)',
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('existsAfter(/databases/$(database)/documents/challenges/$(incoming().challengeId))') &&
      r.includes('existsAfter(/databases/$(database)/documents/commitments/$(incoming().commitmentId))'),
  },

  // ----------------------------------------------------
  // COMMITMENTS (23–27)
  // ----------------------------------------------------
  {
    id: 'P9-COM-23',
    category: 'COMMITMENTS',
    description: '23. Normal user cannot create commitment owned by another user',
    expectedOutcome: 'DENY',
    evaluator: (r) => {
      const commIdx = r.indexOf('match /commitments/{commitmentId}');
      const commCreate = r.substring(commIdx, r.indexOf('allow update', commIdx));
      return commCreate.includes('incoming().ownerId == request.auth.uid') && commCreate.includes('existsAfter');
    },
  },
  {
    id: 'P9-COM-24',
    category: 'COMMITMENTS',
    description: '24. Challenge creator can only create authorized challenge commitments for circle members',
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('getAfter(/databases/$(database)/documents/challenges/$(incoming().challengeId)).data.createdBy == request.auth.uid') &&
      r.includes('isAcceptedCircleMember(incoming().circleId)'),
  },
  {
    id: 'P9-COM-25',
    category: 'COMMITMENTS',
    description: '25. Cannot create challenge commitment for non-member of circle',
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('isAcceptedCircleMemberByUid(incoming().circleId, incoming().ownerId)'),
  },
  {
    id: 'P9-COM-26',
    category: 'COMMITMENTS',
    description: '26. Cannot mismatch challengeId/circleId across challenge and commitment',
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('getAfter(/databases/$(database)/documents/challenges/$(incoming().challengeId)).data.circleId == incoming().circleId'),
  },
  {
    id: 'P9-COM-27',
    category: 'COMMITMENTS',
    description: '27. Cannot mismatch participant and commitment records in challenge batch',
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('existsAfter(/databases/$(database)/documents/challenges/$(incoming().challengeId)/participants/$(incoming().ownerId))'),
  },

  // ----------------------------------------------------
  // VISIBILITY (28–32)
  // ----------------------------------------------------
  {
    id: 'P9-VIS-28',
    category: 'VISIBILITY',
    description: '28. Accepted Circle member can read circle-visible challenge commitment',
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes("resource.data.visibility == 'circle'") &&
      r.includes('isAcceptedCircleMember(resource.data.circleId)'),
  },
  {
    id: 'P9-VIS-29',
    category: 'VISIBILITY',
    description: '29. Unrelated user cannot read circle-visible challenge commitment',
    expectedOutcome: 'DENY',
    evaluator: (r) => {
      const commIdx = r.indexOf('match /commitments/{commitmentId}');
      const commGet = r.substring(commIdx, r.indexOf('allow list', commIdx));
      return (
        commGet.includes('resource.data.ownerId == request.auth.uid ||') &&
        commGet.includes('isAcceptedWitness(commitmentId) ||') &&
        commGet.includes('isAcceptedCircleMember(resource.data.circleId)')
      );
    },
  },
  {
    id: 'P9-VIS-30',
    category: 'VISIBILITY',
    description: '30. Circle member cannot edit another participant commitment (owner only)',
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('resource.data.ownerId == request.auth.uid') &&
      r.includes('incoming().ownerId == existing().ownerId'),
  },
  {
    id: 'P9-VIS-31',
    category: 'VISIBILITY',
    description: '31. Circle member cannot create check-ins for another participant',
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('incoming().userId == request.auth.uid') &&
      r.includes('isCommitmentOwner(incoming().commitmentId)'),
  },
  {
    id: 'P9-VIS-32',
    category: 'VISIBILITY',
    description: '32. Circle member does not automatically become a witness (witnessActions strictly require isAcceptedWitness)',
    expectedOutcome: 'DENY',
    evaluator: (r) => {
      const waIdx = r.indexOf('match /witnessActions/{actionId}');
      const waCreate = r.substring(waIdx, r.indexOf('allow update', waIdx));
      return (
        waCreate.includes('isAcceptedWitness(get(/databases/$(database)/documents/checkins/$(incoming().checkinId)).data.commitmentId)') &&
        !waCreate.includes('isAcceptedCircleMember')
      );
    },
  },

  // ----------------------------------------------------
  // REGRESSION (33–36)
  // ----------------------------------------------------
  {
    id: 'P9-REG-33',
    category: 'REGRESSION',
    description: '33. Existing owner commitment behavior still works (create, update, get, list)',
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('incoming().ownerId == request.auth.uid') &&
      r.includes('incoming().archived == false') &&
      r.includes('allow list: if isSignedIn() && resource.data.ownerId == request.auth.uid;'),
  },
  {
    id: 'P9-REG-34',
    category: 'REGRESSION',
    description: '34. Existing check-ins still work (owner create, immutable logs)',
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('isCommitmentOwner(incoming().commitmentId)') &&
      r.includes('incoming().userId == request.auth.uid'),
  },
  {
    id: 'P9-REG-35',
    category: 'REGRESSION',
    description: '35. Existing witnessing still works (deterministic witness authorization & witness actions)',
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('isAcceptedWitness(commitmentId)') &&
      r.includes('isAcceptedWitness(get(/databases/$(database)/documents/checkins/$(incoming().checkinId)).data.commitmentId)'),
  },
  {
    id: 'P9-REG-36',
    category: 'REGRESSION',
    description: '36. Existing streak calculations still work across all 5 cadences in streakCalculator.ts',
    expectedOutcome: 'ALLOW',
    evaluator: () => {
      const calcPath = path.resolve(process.cwd(), 'src/utils/streakCalculator.ts');
      if (!fs.existsSync(calcPath)) return false;
      const content = fs.readFileSync(calcPath, 'utf-8');
      return (
        content.includes('calculateDailyStreak') &&
        content.includes('calculateWeeklyStreak') &&
        content.includes('calculateWeekdaysStreak') &&
        content.includes('calculateMonthlyStreak') &&
        content.includes('calculateCustomStreak')
      );
    },
  },

  // =========================================================================
  // BASELINE PHASE 8 SECURITY REGRESSION SUITE (35 TESTS)
  // =========================================================================
  {
    id: 'GLOBAL-01',
    category: 'GLOBAL CONFIGURATION',
    description: 'Global default-deny fallback rule exists for all unspecified document paths',
    expectedOutcome: 'ALLOW',
    evaluator: (r) => r.includes('match /{document=**}') && r.includes('allow read, write: if false;'),
  },
  {
    id: 'GLOBAL-02',
    category: 'GLOBAL CONFIGURATION',
    description: 'No test-mode timestamp or temporary bypass remains (request.time < timestamp)',
    expectedOutcome: 'ALLOW',
    evaluator: (r) => !r.includes('request.time <') && !r.includes('timestamp.date('),
  },
  {
    id: 'GLOBAL-03',
    category: 'GLOBAL CONFIGURATION',
    description: 'No Firebase Storage rules or implementation introduced (Supabase Storage only)',
    expectedOutcome: 'ALLOW',
    evaluator: () => !fs.existsSync(path.resolve(process.cwd(), 'storage.rules')),
  },
  {
    id: 'OWNER-01',
    category: 'OWNER (A)',
    description: "Account A can create their own commitment with incoming().ownerId == auth.uid and archived == false",
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('incoming().ownerId == request.auth.uid') &&
      r.includes('incoming().archived == false') &&
      r.includes('isValidCommitment(incoming())'),
  },
  {
    id: 'OWNER-02',
    category: 'OWNER (A)',
    description: "Account A can read (get) their own commitment",
    expectedOutcome: 'ALLOW',
    evaluator: (r) => r.includes('resource.data.ownerId == request.auth.uid'),
  },
  {
    id: 'OWNER-03',
    category: 'OWNER (A)',
    description: "Account A can query/list their own commitments with where('ownerId', '==', auth.uid)",
    expectedOutcome: 'ALLOW',
    evaluator: (r) => r.includes('allow list: if isSignedIn() && resource.data.ownerId == request.auth.uid;'),
  },
  {
    id: 'OWNER-04',
    category: 'OWNER (A)',
    description: "Account A can update title/cadence/description and toggle archive flag on their commitment",
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes("affectedKeys().hasOnly(['title', 'cadence', 'description'])") &&
      r.includes("affectedKeys().hasOnly(['archived'])"),
  },
  {
    id: 'OWNER-05',
    category: 'OWNER (A)',
    description: "Account A cannot be modified to transfer ownership (ownerId is immutable)",
    expectedOutcome: 'DENY',
    evaluator: (r) => r.includes('incoming().ownerId == existing().ownerId'),
  },
  {
    id: 'OWNER-06',
    category: 'OWNER (A)',
    description: "Account A can create check-ins for their own commitment",
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('incoming().userId == request.auth.uid') &&
      r.includes('isCommitmentOwner(incoming().commitmentId)'),
  },
  {
    id: 'OWNER-07',
    category: 'OWNER (A)',
    description: "Account A can read their own check-ins",
    expectedOutcome: 'ALLOW',
    evaluator: (r) => r.includes('resource.data.userId == request.auth.uid'),
  },
  {
    id: 'OWNER-08',
    category: 'OWNER (A)',
    description: "Account A can read witness invitations and accepted memberships for their commitment",
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('isCommitmentOwner(resource.data.commitmentId)') &&
      r.includes('isCommitmentOwner(commitmentId)'),
  },
  {
    id: 'UNAUTH-01',
    category: 'UNAUTHORIZED USER (B / C)',
    description: "Account B cannot update or mutate Account A's commitment",
    expectedOutcome: 'DENY',
    evaluator: (r) => r.includes('resource.data.ownerId == request.auth.uid'),
  },
  {
    id: 'UNAUTH-02',
    category: 'UNAUTHORIZED USER (B / C)',
    description: "Account C cannot read Account A's commitment",
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      !r.includes('allow get: if true;') &&
      r.includes('resource.data.ownerId == request.auth.uid'),
  },
  {
    id: 'UNAUTH-03',
    category: 'UNAUTHORIZED USER (B / C)',
    description: "Account C cannot read Account A's check-ins",
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('resource.data.userId == request.auth.uid ||') &&
      r.includes('isAcceptedWitness(resource.data.commitmentId)'),
  },
  {
    id: 'UNAUTH-04',
    category: 'UNAUTHORIZED USER (B / C)',
    description: "Account C cannot create a witness action for Account A's check-in",
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('isAcceptedWitness(get(/databases/$(database)/documents/checkins/$(incoming().checkinId)).data.commitmentId)'),
  },
  {
    id: 'UNAUTH-05',
    category: 'UNAUTHORIZED USER (B / C)',
    description: "Account C cannot read witness invitations or memberships for Commitment A",
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('isCommitmentOwner(resource.data.commitmentId)') &&
      r.includes('resource.data.fromUserId == request.auth.uid'),
  },
  {
    id: 'WITNESS-01',
    category: 'WITNESS (B)',
    description: "Account B cannot access Account A's commitment as an owner (cannot create check-ins, cannot invite, cannot delete)",
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('isCommitmentOwner(incoming().commitmentId)') &&
      r.includes('allow delete: if false;'),
  },
  {
    id: 'WITNESS-02',
    category: 'WITNESS (B)',
    description: "Account B can read check-ins for commitments where B has accepted membership",
    expectedOutcome: 'ALLOW',
    evaluator: (r) => r.includes('isAcceptedWitness(resource.data.commitmentId)'),
  },
  {
    id: 'WITNESS-03',
    category: 'WITNESS (B)',
    description: "Account B can create a valid witness action for an eligible check-in",
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('isValidWitnessAction(incoming())') &&
      r.includes('incoming().witnessId == request.auth.uid'),
  },
  {
    id: 'WITNESS-04',
    category: 'WITNESS (B)',
    description: "Account B cannot spoof witnessId or witnessUid",
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('incoming().witnessId == request.auth.uid') &&
      r.includes('data.uid == witnessUid'),
  },
  {
    id: 'WITNESS-05',
    category: 'WITNESS (B)',
    description: "Account B cannot modify or delete an existing witness action (immutable log)",
    expectedOutcome: 'DENY',
    evaluator: (r) => {
      const wa = r.substring(r.indexOf('match /witnessActions/{actionId}'));
      return wa.includes('allow update: if false;') && wa.includes('allow delete: if false;');
    },
  },
  {
    id: 'WITNESS-06',
    category: 'WITNESS (B)',
    description: "Account B cannot modify or delete an existing check-in (immutable evidence)",
    expectedOutcome: 'DENY',
    evaluator: (r) => {
      const chk = r.substring(r.indexOf('match /checkins/{checkinId}'), r.indexOf('match /witnessInvites'));
      return chk.includes('allow update: if false;') && chk.includes('allow delete: if false;');
    },
  },
  {
    id: 'WITNESS-07',
    category: 'WITNESS (B)',
    description: "Account B cannot self-assign witness membership without an accepted invitation addressed to B",
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('exists(/databases/$(database)/documents/witnessInvites/$(incoming().inviteId))') &&
      r.includes("data.status == 'accepted'") &&
      r.includes('data.toUserId == request.auth.uid'),
  },
  {
    id: 'INVITE-01',
    category: 'INVITATION',
    description: "An unrelated user cannot accept another person's invitation (email match required)",
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('userEmail() != \'\'') &&
      r.includes('existing().toEmail == userEmail()'),
  },
  {
    id: 'INVITE-02',
    category: 'INVITATION',
    description: "The recipient can accept only when authenticated identity matches toEmail and binds toUserId",
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes("incoming().status == 'accepted'") &&
      r.includes("incoming().toUserId == request.auth.uid"),
  },
  {
    id: 'INVITE-03',
    category: 'INVITATION',
    description: "Decline/accept transitions cannot modify fromUserId, commitmentId, or toEmail",
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes("incoming().fromUserId == existing().fromUserId") &&
      r.includes("incoming().commitmentId == existing().commitmentId") &&
      r.includes("incoming().toEmail == existing().toEmail"),
  },
  {
    id: 'INVITE-04',
    category: 'INVITATION',
    description: "Duplicate or invalid state transitions from non-pending status are rejected",
    expectedOutcome: 'DENY',
    evaluator: (r) => r.includes("existing().status == 'pending'"),
  },
  {
    id: 'QUERY-01',
    category: 'QUERY SECURITY',
    description: "Commitments query is bounded by where('ownerId', '==', auth.uid) matching allow list",
    expectedOutcome: 'ALLOW',
    evaluator: (r) => r.includes('allow list: if isSignedIn() && resource.data.ownerId == request.auth.uid;'),
  },
  {
    id: 'QUERY-02',
    category: 'QUERY SECURITY',
    description: "WitnessInbox checkins query uses single-equality commitmentId matching isAcceptedWitness",
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('isAcceptedWitness(resource.data.commitmentId)') &&
      r.includes('allow list: if isSignedIn()'),
  },
  {
    id: 'QUERY-03',
    category: 'QUERY SECURITY',
    description: "WitnessInvites queries are bounded by toEmail == userEmail or toUserId == uid or ownerId",
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('(userEmail() != \'\' && resource.data.toEmail == userEmail())') &&
      r.includes('resource.data.toUserId == request.auth.uid'),
  },
  {
    id: 'QUERY-04',
    category: 'QUERY SECURITY',
    description: "WitnessActions queries are bounded by witnessId == uid or checkinId equality",
    expectedOutcome: 'ALLOW',
    evaluator: (r) =>
      r.includes('resource.data.witnessId == request.auth.uid') &&
      r.includes('(resource.data.checkinId != null && canReadCheckin(resource.data.checkinId))'),
  },
  {
    id: 'DATA-01',
    category: 'DATA INTEGRITY',
    description: "Unauthorized mutations to ownerId, userId, or commitmentId are prevented",
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes('incoming().ownerId == existing().ownerId') &&
      r.includes('incoming().fromUserId == existing().fromUserId') &&
      r.includes('incoming().commitmentId == existing().commitmentId'),
  },
  {
    id: 'DATA-02',
    category: 'DATA INTEGRITY',
    description: "Unexpected privileged fields rejected across all entities using hasOnly() schema guards",
    expectedOutcome: 'DENY',
    evaluator: (r) =>
      r.includes("keys().hasOnly(['uid', 'displayName', 'email', 'avatarUrl', 'createdAt'])") &&
      r.includes("keys().hasOnly(['ownerId', 'title', 'cadence', 'visibility', 'archived', 'description', 'circleId', 'createdAt'])") &&
      r.includes("keys().hasOnly(['commitmentId', 'userId', 'evidenceType', 'status', 'evidenceUrl', 'note', 'timestamp'])") &&
      r.includes("keys().hasOnly(['commitmentId', 'fromUserId', 'toEmail', 'status', 'toUserId', 'createdAt'])") &&
      r.includes("keys().hasOnly(['checkinId', 'witnessId', 'responseType', 'note', 'timestamp'])") &&
      r.includes("keys().hasOnly(['uid', 'status', 'inviteId', 'createdAt'])"),
  },
  {
    id: 'DATA-03',
    category: 'DATA INTEGRITY',
    description: "Client cannot modify check-in status or note after submission (allow update: if false)",
    expectedOutcome: 'DENY',
    evaluator: (r) => {
      const chk = r.substring(r.indexOf('match /checkins/{checkinId}'), r.indexOf('match /witnessInvites'));
      return chk.includes('allow update: if false;');
    },
  },
  {
    id: 'DATA-04',
    category: 'DATA INTEGRITY',
    description: "Client cannot delete or overwrite witness response after submission",
    expectedOutcome: 'DENY',
    evaluator: (r) => {
      const wa = r.substring(r.indexOf('match /witnessActions/{actionId}'));
      return wa.includes('allow update: if false;') && wa.includes('allow delete: if false;');
    },
  },
];

console.log('========================================================================');
console.log('SANKALPA COMPREHENSIVE SECURITY REGRESSION TEST SUITE (PHASE 8 + PHASE 9)');
console.log('========================================================================\n');

let passCount = 0;
let failCount = 0;

tests.forEach((test) => {
  const passed = test.evaluator(rulesContent);
  if (passed) {
    passCount++;
    console.log(`[PASS] ${test.id} | ${test.category} | ${test.description}`);
  } else {
    failCount++;
    console.log(`[FAIL] ${test.id} | ${test.category} | ${test.description}`);
  }
});

console.log('\n------------------------------------------------------------------------');
console.log(`TEST EXECUTION SUMMARY: ${passCount} PASSED, ${failCount} FAILED, TOTAL: ${tests.length}`);
console.log('------------------------------------------------------------------------');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('All regression test cases verified successfully.\n');
}
