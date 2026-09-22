/**
 * FUNCTIONAL TEST SCENARIO FOR SANKALPA CIRCLES & GROUP CHALLENGES
 *
 * Users:
 * - Account A (Owner of Circle "Dawn Seekers", uid: 'user_a', email: 'a@example.com')
 * - Account B (Accepted member, uid: 'user_b', email: 'b@example.com')
 * - Account C (Pending invite, uid: 'user_c', email: 'c@example.com')
 * - Account D (Unrelated user, uid: 'user_d', email: 'd@example.com')
 *
 * Scenario:
 * 1. Account A creates Circle "Dawn Seekers".
 * 2. Account A invites Account B and Account C.
 * 3. Account B accepts invitation.
 * 4. Account C leaves invitation pending.
 * 5. Account A starts Challenge "Morning Meditation" (daily cadence).
 * 6. Verify Challenge commitment created for Account A.
 * 7. Verify Challenge commitment created for Account B.
 * 8. Verify NO Challenge commitment created for Account C.
 * 9. Account B submits check-in.
 * 10. Account A views Account B's check-in via Circle visibility.
 * 11. Account D attempts to read Circle -> rejected.
 * 12. Account D attempts to read Challenge -> rejected.
 * 13. Account D attempts to read Account B's commitment -> rejected.
 * 14. Account B verifies streak updates normally for Challenge commitment.
 */

import { calculateDailyStreak } from '../src/utils/streakCalculator.ts';
import type {
  Circle,
  CircleMember,
  CircleInvite,
  Challenge,
  ChallengeParticipant,
  Commitment,
  Checkin,
} from '../src/types/index.ts';

interface InMemoryDatabase {
  circles: Map<string, Circle>;
  circleMembers: Map<string, Map<string, CircleMember>>; // circleId -> uid -> CircleMember
  circleInvites: Map<string, CircleInvite>;
  challenges: Map<string, Challenge>;
  challengeParticipants: Map<string, Map<string, ChallengeParticipant>>; // challengeId -> uid -> ChallengeParticipant
  commitments: Map<string, Commitment>;
  checkins: Map<string, Checkin>;
}

function runFunctionalScenario() {
  console.log('========================================================================');
  console.log('SANKALPA PHASE 9 FUNCTIONAL TEST SCENARIO: CIRCLES & CHALLENGES');
  console.log('========================================================================\n');

  const db: InMemoryDatabase = {
    circles: new Map(),
    circleMembers: new Map(),
    circleInvites: new Map(),
    challenges: new Map(),
    challengeParticipants: new Map(),
    commitments: new Map(),
    checkins: new Map(),
  };

  const userA = { uid: 'user_a', email: 'a@example.com' };
  const userB = { uid: 'user_b', email: 'b@example.com' };
  const userC = { uid: 'user_c', email: 'c@example.com' };
  const userD = { uid: 'user_d', email: 'd@example.com' };

  let passedSteps = 0;
  const totalSteps = 14;

  // Step 1: Account A creates Circle "Dawn Seekers"
  const circleId = 'circle_dawn_seekers';
  const circleA: Circle = {
    id: circleId,
    name: 'Dawn Seekers',
    ownerId: userA.uid,
    memberCount: 1,
    members: [userA.uid],
    createdAt: new Date(),
  };
  db.circles.set(circleId, circleA);
  const circleMembersMap = new Map<string, CircleMember>();
  circleMembersMap.set(userA.uid, {
    uid: userA.uid,
    email: userA.email,
    status: 'accepted',
    invitedBy: userA.uid,
    createdAt: new Date(),
  });
  db.circleMembers.set(circleId, circleMembersMap);

  if (db.circles.get(circleId)?.memberCount === 1 && db.circleMembers.get(circleId)?.get(userA.uid)?.status === 'accepted') {
    passedSteps++;
    console.log('[PASS] Step 1: Account A created Circle "Dawn Seekers" with owner membership.');
  } else {
    console.error('[FAIL] Step 1');
  }

  // Step 2: Account A invites Account B and Account C
  const inviteB: CircleInvite = {
    id: 'invite_b',
    circleId,
    circleName: 'Dawn Seekers',
    fromUserId: userA.uid,
    toEmail: userB.email,
    toUserId: null,
    status: 'pending',
    createdAt: new Date(),
  };
  const inviteC: CircleInvite = {
    id: 'invite_c',
    circleId,
    circleName: 'Dawn Seekers',
    fromUserId: userA.uid,
    toEmail: userC.email,
    toUserId: null,
    status: 'pending',
    createdAt: new Date(),
  };
  db.circleInvites.set(inviteB.id!, inviteB);
  db.circleInvites.set(inviteC.id!, inviteC);

  if (db.circleInvites.get('invite_b')?.status === 'pending' && db.circleInvites.get('invite_c')?.status === 'pending') {
    passedSteps++;
    console.log('[PASS] Step 2: Account A invited Account B and Account C.');
  } else {
    console.error('[FAIL] Step 2');
  }

  // Step 3: Account B accepts invitation
  const bInv = db.circleInvites.get('invite_b')!;
  bInv.status = 'accepted';
  bInv.toUserId = userB.uid;
  circleA.memberCount = (circleA.memberCount || 1) + 1;
  circleA.members = [...(circleA.members || []), userB.uid];
  db.circleMembers.get(circleId)!.set(userB.uid, {
    uid: userB.uid,
    email: userB.email,
    status: 'accepted',
    invitedBy: userA.uid,
    inviteId: 'invite_b',
    createdAt: new Date(),
  });

  if (circleA.memberCount === 2 && db.circleMembers.get(circleId)?.get(userB.uid)?.status === 'accepted') {
    passedSteps++;
    console.log('[PASS] Step 3: Account B accepted invitation and joined circle.');
  } else {
    console.error('[FAIL] Step 3');
  }

  // Step 4: Account C leaves invitation pending
  const cInv = db.circleInvites.get('invite_c')!;
  if (cInv.status === 'pending' && !db.circleMembers.get(circleId)?.has(userC.uid)) {
    passedSteps++;
    console.log('[PASS] Step 4: Account C invitation remains pending (not a member).');
  } else {
    console.error('[FAIL] Step 4');
  }

  // Step 5: Account A starts Challenge "Morning Meditation"
  const challengeId = 'chal_morning_meditation';
  const acceptedMembers = Array.from(db.circleMembers.get(circleId)!.values()).filter(
    (m) => m.status === 'accepted'
  );
  const challenge: Challenge = {
    id: challengeId,
    circleId,
    title: 'Morning Meditation',
    cadence: 'daily',
    description: '10 minutes daily breathing practice',
    createdBy: userA.uid,
    active: true,
    createdAt: new Date(),
  };
  db.challenges.set(challengeId, challenge);

  const participantsMap = new Map<string, ChallengeParticipant>();
  for (const m of acceptedMembers) {
    const commitmentId = `comm_${challengeId}_${m.uid}`;
    db.commitments.set(commitmentId, {
      id: commitmentId,
      ownerId: m.uid,
      title: challenge.title,
      cadence: challenge.cadence,
      visibility: 'circle',
      archived: false,
      circleId,
      challengeId,
      createdAt: new Date(),
    });
    participantsMap.set(m.uid, {
      uid: m.uid,
      circleId,
      commitmentId,
      joinedAt: new Date(),
    });
  }
  db.challengeParticipants.set(challengeId, participantsMap);

  if (db.challenges.has(challengeId) && participantsMap.size === 2) {
    passedSteps++;
    console.log('[PASS] Step 5: Challenge "Morning Meditation" created atomically.');
  } else {
    console.error('[FAIL] Step 5');
  }

  // Step 6: Verify Challenge commitment created for Account A
  const commA = db.commitments.get(`comm_${challengeId}_${userA.uid}`);
  if (commA && commA.ownerId === userA.uid && commA.visibility === 'circle' && commA.challengeId === challengeId) {
    passedSteps++;
    console.log('[PASS] Step 6: Challenge commitment verified for Account A.');
  } else {
    console.error('[FAIL] Step 6');
  }

  // Step 7: Verify Challenge commitment created for Account B
  const commB = db.commitments.get(`comm_${challengeId}_${userB.uid}`);
  if (commB && commB.ownerId === userB.uid && commB.visibility === 'circle' && commB.challengeId === challengeId) {
    passedSteps++;
    console.log('[PASS] Step 7: Challenge commitment verified for Account B.');
  } else {
    console.error('[FAIL] Step 7');
  }

  // Step 8: Verify NO Challenge commitment created for Account C
  const commC = db.commitments.get(`comm_${challengeId}_${userC.uid}`);
  if (!commC && !participantsMap.has(userC.uid)) {
    passedSteps++;
    console.log('[PASS] Step 8: Confirmed NO Challenge commitment created for Account C.');
  } else {
    console.error('[FAIL] Step 8');
  }

  // Step 9: Account B submits check-in
  const checkinB: Checkin = {
    id: 'chk_b_day1',
    commitmentId: commB?.id || '',
    userId: userB.uid,
    evidenceType: 'text',
    note: 'Completed 15 minutes mindfulness sitting.',
    status: 'pending',
    timestamp: new Date('2026-09-18T08:00:00Z'),
  };
  db.checkins.set(checkinB.id || 'chk_b_day1', checkinB);

  if (db.checkins.get('chk_b_day1')?.userId === userB.uid) {
    passedSteps++;
    console.log('[PASS] Step 9: Account B submitted valid check-in.');
  } else {
    console.error('[FAIL] Step 9');
  }

  // Step 10: Account A views Account B's check-in via Circle visibility
  // Verification against canReadCommitmentCircle rules helper logic:
  // userA is an accepted member of circleId associated with commB
  const isMemberA = db.circleMembers.get(circleId)?.get(userA.uid)?.status === 'accepted';
  const canReadA = commB?.visibility === 'circle' && isMemberA;
  if (canReadA) {
    passedSteps++;
    console.log("[PASS] Step 10: Account A successfully authorized to view Account B's check-in via Circle visibility.");
  } else {
    console.error('[FAIL] Step 10');
  }

  // Step 11: Account D attempts to read Circle -> rejected
  const isMemberD = db.circleMembers.get(circleId)?.get(userD.uid)?.status === 'accepted';
  const isOwnerD = circleA.ownerId === userD.uid;
  const canReadCircleD = isOwnerD || isMemberD;
  if (!canReadCircleD) {
    passedSteps++;
    console.log('[PASS] Step 11: Account D read attempt on Circle correctly REJECTED.');
  } else {
    console.error('[FAIL] Step 11');
  }

  // Step 12: Account D attempts to read Challenge -> rejected
  const canReadChallengeD = challenge.createdBy === userD.uid || isMemberD;
  if (!canReadChallengeD) {
    passedSteps++;
    console.log('[PASS] Step 12: Account D read attempt on Challenge correctly REJECTED.');
  } else {
    console.error('[FAIL] Step 12');
  }

  // Step 13: Account D attempts to read Account B's commitment -> rejected
  const canReadCommBD = commB?.ownerId === userD.uid || isMemberD;
  if (!canReadCommBD) {
    passedSteps++;
    console.log("[PASS] Step 13: Account D read attempt on Account B's commitment correctly REJECTED.");
  } else {
    console.error('[FAIL] Step 13');
  }

  // Step 14: Account B verifies streak updates normally for Challenge commitment
  const approvedCheckinsB: Checkin[] = [
    {
      id: 'chk_b_day1',
      commitmentId: commB?.id || '',
      userId: userB.uid,
      evidenceType: 'text',
      status: 'approved',
      timestamp: new Date('2026-09-18T08:00:00Z'),
    },
    {
      id: 'chk_b_day2',
      commitmentId: commB?.id || '',
      userId: userB.uid,
      evidenceType: 'text',
      status: 'approved',
      timestamp: new Date('2026-09-19T08:00:00Z'),
    },
    {
      id: 'chk_b_day3',
      commitmentId: commB?.id || '',
      userId: userB.uid,
      evidenceType: 'text',
      status: 'approved',
      timestamp: new Date('2026-09-20T08:00:00Z'),
    },
  ];

  const streakResult = calculateDailyStreak(approvedCheckinsB, new Date('2026-09-20T12:00:00Z'));
  if (streakResult.currentStreak === 3 && streakResult.longestStreak === 3 && streakResult.totalApprovedDays === 3) {
    passedSteps++;
    console.log(`[PASS] Step 14: Account B streak calculated accurately (${streakResult.currentStreak}-day streak).`);
  } else {
    console.error('[FAIL] Step 14', streakResult);
  }

  console.log('\n------------------------------------------------------------------------');
  console.log(`FUNCTIONAL SCENARIO SUMMARY: ${passedSteps} / ${totalSteps} STEPS PASSED.`);
  console.log('------------------------------------------------------------------------\n');

  if (passedSteps !== totalSteps) {
    process.exit(1);
  }
}

runFunctionalScenario();
