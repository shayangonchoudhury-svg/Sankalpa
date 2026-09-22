/**
 * SANKALPA FIRESTORE EMULATOR SECURITY VERIFICATION TEST SUITE
 * Uses @firebase/rules-unit-testing against running Firestore emulator
 * and current production firestore.rules.
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ID = 'sankalpa-security-verification';
const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function recordTest(num: number, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ num, name, passed: true });
    console.log(`[PASS] Test ${num}: ${name}`);
  } catch (err: any) {
    results.push({ num, name, passed: false, error: err?.message || String(err) });
    console.error(`[FAIL] Test ${num}: ${name} -> ${err?.message || err}`);
  }
}

async function run() {
  console.log('========================================================================');
  console.log('SANKALPA FIRESTORE EMULATOR SECURITY TEST SUITE');
  console.log('========================================================================\n');

  let testEnv: RulesTestEnvironment;
  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  } catch (err: any) {
    console.error('Failed to initialize test environment with Firestore emulator:', err);
    process.exit(1);
  }

  // Setup seed documents using admin context (bypasses rules)
  await testEnv.withSecurityRulesDisabled(async (adminContext) => {
    const adminDb = adminContext.firestore();

    // Users
    await setDoc(doc(adminDb, 'users', 'user_a'), {
      uid: 'user_a',
      displayName: 'User A',
      email: 'usera@example.com',
      avatarUrl: null,
      createdAt: Timestamp.now(),
      notificationPrefs: {
        checkinDue: true,
        witnessInvited: true,
        witnessResponded: true,
        challengeStarted: true,
      },
    });

    await setDoc(doc(adminDb, 'users', 'user_b'), {
      uid: 'user_b',
      displayName: 'User B',
      email: 'userb@example.com',
      avatarUrl: null,
      createdAt: Timestamp.now(),
      notificationPrefs: {
        checkinDue: true,
        witnessInvited: true,
        witnessResponded: true,
        challengeStarted: true,
      },
    });

    await setDoc(doc(adminDb, 'users', 'witness_w'), {
      uid: 'witness_w',
      displayName: 'Witness W',
      email: 'witnessw@example.com',
      avatarUrl: null,
      createdAt: Timestamp.now(),
      notificationPrefs: {
        checkinDue: true,
        witnessInvited: true,
        witnessResponded: true,
        challengeStarted: true,
      },
    });

    // Commitments
    await setDoc(doc(adminDb, 'commitments', 'comm_private_a'), {
      ownerId: 'user_a',
      title: 'Daily Meditation',
      cadence: 'daily',
      visibility: 'private',
      archived: false,
      createdAt: Timestamp.now(),
    });

    await setDoc(doc(adminDb, 'commitments', 'comm_witnessed_a'), {
      ownerId: 'user_a',
      title: 'Morning Yoga',
      cadence: 'daily',
      visibility: 'witnesses_only',
      archived: false,
      createdAt: Timestamp.now(),
    });

    // Witness membership on comm_witnessed_a
    await setDoc(doc(adminDb, 'commitments', 'comm_witnessed_a', 'witnesses', 'witness_w'), {
      uid: 'witness_w',
      status: 'accepted',
      createdAt: Timestamp.now(),
    });

    // Checkins
    await setDoc(doc(adminDb, 'checkins', 'chk_a_1'), {
      commitmentId: 'comm_witnessed_a',
      userId: 'user_a',
      evidenceType: 'text',
      status: 'pending',
      note: 'Yoga done for 30 minutes',
      timestamp: Timestamp.now(),
    });

    await setDoc(doc(adminDb, 'checkins', 'chk_private_a'), {
      commitmentId: 'comm_private_a',
      userId: 'user_a',
      evidenceType: 'text',
      status: 'pending',
      note: 'Meditation done for 15 minutes',
      timestamp: Timestamp.now(),
    });

    // Witness invite
    await setDoc(doc(adminDb, 'witnessInvites', 'invite_accepted_1'), {
      commitmentId: 'comm_witnessed_a',
      fromUserId: 'user_a',
      toEmail: 'witnessw@example.com',
      toUserId: 'witness_w',
      status: 'accepted',
      createdAt: Timestamp.now(),
    });

    // Circle at capacity 10
    const memberUids = Array.from({ length: 10 }, (_, i) => `member_${i + 1}`);
    await setDoc(doc(adminDb, 'circles', 'circle_full_10'), {
      name: 'Full Circle 10',
      ownerId: 'member_1',
      memberCount: 10,
      members: memberUids,
      createdAt: Timestamp.now(),
    });

    // Circle members
    for (const mUid of memberUids) {
      await setDoc(doc(adminDb, 'circles', 'circle_full_10', 'members', mUid), {
        uid: mUid,
        email: `${mUid}@example.com`,
        status: 'accepted',
        createdAt: Timestamp.now(),
      });
    }

    // Circle with space
    await setDoc(doc(adminDb, 'circles', 'circle_open'), {
      name: 'Open Circle',
      ownerId: 'user_a',
      memberCount: 1,
      members: ['user_a'],
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(adminDb, 'circles', 'circle_open', 'members', 'user_a'), {
      uid: 'user_a',
      email: 'usera@example.com',
      status: 'accepted',
      createdAt: Timestamp.now(),
    });

    // Challenge in circle_open
    await setDoc(doc(adminDb, 'challenges', 'chal_open_1'), {
      circleId: 'circle_open',
      title: '30 Day Challenge',
      cadence: 'daily',
      createdBy: 'user_a',
      active: true,
      createdAt: Timestamp.now(),
    });

    // Existing witnessAction
    await setDoc(doc(adminDb, 'witnessActions', 'wa_existing_1'), {
      checkinId: 'chk_a_1',
      witnessId: 'witness_w',
      responseType: 'approved',
      note: 'Great job!',
      timestamp: Timestamp.now(),
    });

    // Notification for user_b
    await setDoc(doc(adminDb, 'notifications', 'notif_b_1'), {
      userId: 'user_b',
      type: 'checkin_due',
      title: 'Check-in Due',
      body: 'Time to check in',
      relatedId: 'comm_b_fake',
      read: false,
      createdAt: Timestamp.now(),
    });
  });

  // Client contexts
  const ctxUserA = testEnv.authenticatedContext('user_a', { email: 'usera@example.com' });
  const ctxUserB = testEnv.authenticatedContext('user_b', { email: 'userb@example.com' });
  const ctxWitnessW = testEnv.authenticatedContext('witness_w', { email: 'witnessw@example.com' });
  const ctxStranger = testEnv.authenticatedContext('stranger_x', { email: 'stranger@example.com' });
  const ctxUnauth = testEnv.unauthenticatedContext();

  const dbA = ctxUserA.firestore();
  const dbB = ctxUserB.firestore();
  const dbW = ctxWitnessW.firestore();
  const dbStranger = ctxStranger.firestore();
  const dbUnauth = ctxUnauth.firestore();

  // --- 1. Private commitment isolation ---
  await recordTest(1, 'Private commitment isolation (Owner reads, stranger cannot)', async () => {
    await assertSucceeds(getDoc(doc(dbA, 'commitments', 'comm_private_a')));
    await assertFails(getDoc(doc(dbB, 'commitments', 'comm_private_a')));
    await assertFails(getDoc(doc(dbStranger, 'commitments', 'comm_private_a')));
  });

  // --- 2. Check-in isolation ---
  await recordTest(2, 'Check-in isolation (Owner reads, stranger cannot)', async () => {
    await assertSucceeds(getDoc(doc(dbA, 'checkins', 'chk_private_a')));
    await assertFails(getDoc(doc(dbB, 'checkins', 'chk_private_a')));
    await assertFails(getDoc(doc(dbStranger, 'checkins', 'chk_private_a')));
  });

  // --- 3. Witness authorization ---
  await recordTest(3, 'Witness authorization (Accepted witness reads check-in, non-witness cannot)', async () => {
    await assertSucceeds(getDoc(doc(dbW, 'checkins', 'chk_a_1')));
    await assertFails(getDoc(doc(dbStranger, 'checkins', 'chk_a_1')));
  });

  // --- 4. Self-witness prevention ---
  await recordTest(4, 'Self-witness prevention (User cannot approve own check-in as witness)', async () => {
    await assertFails(
      setDoc(doc(dbA, 'witnessActions', 'wa_self_approve'), {
        checkinId: 'chk_a_1',
        witnessId: 'user_a',
        responseType: 'approved',
      })
    );
  });

  // --- 5. Witness action without authorization ---
  await recordTest(5, 'Witness action without authorization (Stranger cannot create witness action)', async () => {
    await assertFails(
      setDoc(doc(dbStranger, 'witnessActions', 'wa_stranger_approve'), {
        checkinId: 'chk_a_1',
        witnessId: 'stranger_x',
        responseType: 'approved',
      })
    );
  });

  // --- 6. Duplicate witness action ---
  await recordTest(6, 'Duplicate witness action (Witness cannot update/overwrite existing action)', async () => {
    // Attempting to overwrite existing action fails
    await assertFails(
      setDoc(doc(dbW, 'witnessActions', 'wa_existing_1'), {
        checkinId: 'chk_a_1',
        witnessId: 'witness_w',
        responseType: 'flagged',
      })
    );
    await assertFails(
      updateDoc(doc(dbW, 'witnessActions', 'wa_existing_1'), {
        responseType: 'flagged',
      })
    );
  });

  // --- 7. Profile protection ---
  await recordTest(7, 'Profile protection (User A cannot modify User B profile fields)', async () => {
    await assertFails(
      updateDoc(doc(dbA, 'users', 'user_b'), {
        displayName: 'Hacked By A',
      })
    );
    await assertFails(
      updateDoc(doc(dbA, 'users', 'user_b'), {
        avatarUrl: 'https://evil.com/pic.png',
      })
    );
    await assertFails(
      updateDoc(doc(dbA, 'users', 'user_b'), {
        notificationPrefs: { checkinDue: false },
      })
    );
  });

  // --- 8. Identity protection ---
  await recordTest(8, 'Identity protection (User cannot modify uid, email, createdAt or inject role)', async () => {
    await assertFails(
      updateDoc(doc(dbA, 'users', 'user_a'), {
        email: 'hacked_email@example.com',
      })
    );
    await assertFails(
      updateDoc(doc(dbA, 'users', 'user_a'), {
        role: 'admin',
      })
    );
    await assertFails(
      updateDoc(doc(dbA, 'users', 'user_a'), {
        uid: 'spoofed_uid',
      })
    );
  });

  // --- 9. Notification isolation ---
  await recordTest(9, 'Notification isolation (User A cannot read, update read-state, or forge notifications for User B)', async () => {
    // User A cannot read User B's notification
    await assertFails(getDoc(doc(dbA, 'notifications', 'notif_b_1')));

    // User A cannot update User B's notification read state
    await assertFails(
      updateDoc(doc(dbA, 'notifications', 'notif_b_1'), {
        read: true,
      })
    );

    // User A cannot forge arbitrary notification for User B
    await assertFails(
      setDoc(doc(dbA, 'notifications', 'notif_forged_1'), {
        userId: 'user_b',
        type: 'checkin_due',
        title: 'Spam',
        body: 'Spam body',
        relatedId: 'fake_comm_123',
        read: false,
      })
    );
  });

  // --- 10. Circle membership cap ---
  await recordTest(10, 'Circle membership cap (Circle at 10-member limit rejects 11th member)', async () => {
    // Attempting to increment memberCount to 11
    await assertFails(
      updateDoc(doc(dbA, 'circles', 'circle_full_10'), {
        memberCount: 11,
      })
    );
    // Attempting to add member to 10-member circle
    await assertFails(
      setDoc(doc(dbStranger, 'circles', 'circle_full_10', 'members', 'stranger_x'), {
        uid: 'stranger_x',
        email: 'stranger@example.com',
        status: 'accepted',
      })
    );
  });

  // --- 11. Circle self-assignment ---
  await recordTest(11, 'Circle self-assignment (Arbitrary user cannot self-assign membership without invite)', async () => {
    await assertFails(
      setDoc(doc(dbStranger, 'circles', 'circle_open', 'members', 'stranger_x'), {
        uid: 'stranger_x',
        email: 'stranger@example.com',
        status: 'accepted',
      })
    );
  });

  // --- 12. Challenge authorization ---
  await recordTest(12, 'Challenge authorization (Non-member cannot read circle challenge)', async () => {
    await assertSucceeds(getDoc(doc(dbA, 'challenges', 'chal_open_1')));
    await assertFails(getDoc(doc(dbStranger, 'challenges', 'chal_open_1')));
  });

  // --- 13. Check-in ownership ---
  await recordTest(13, 'Check-in ownership (User cannot create check-in referencing another user commitment)', async () => {
    await assertFails(
      setDoc(doc(dbB, 'checkins', 'chk_b_hijack'), {
        commitmentId: 'comm_private_a',
        userId: 'user_b',
        evidenceType: 'text',
        note: 'Hijacked check-in',
        status: 'pending',
      })
    );
  });

  // --- 14. Immutable records ---
  await recordTest(14, 'Immutable records (Client cannot delete commitments, checkins, witnessActions, accepted witnessInvites)', async () => {
    // Delete commitment denied
    await assertFails(deleteDoc(doc(dbA, 'commitments', 'comm_private_a')));
    // Delete check-in denied
    await assertFails(deleteDoc(doc(dbA, 'checkins', 'chk_private_a')));
    // Delete witnessAction denied
    await assertFails(deleteDoc(doc(dbW, 'witnessActions', 'wa_existing_1')));
    // Delete accepted invite denied
    await assertFails(deleteDoc(doc(dbA, 'witnessInvites', 'invite_accepted_1')));
  });

  // Seed documents for Dirty Dozen suite
  await testEnv.withSecurityRulesDisabled(async (adminContext) => {
    const adminDb = adminContext.firestore();
    await setDoc(doc(adminDb, 'commitments', 'c_existing_1'), {
      ownerId: 'owner_uid_1',
      title: 'Original Title',
      cadence: 'daily',
      visibility: 'private',
      archived: false,
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(adminDb, 'checkins', 'chk_existing_1'), {
      commitmentId: 'c_existing_1',
      userId: 'practitioner_uid_1',
      evidenceType: 'text',
      status: 'pending',
      note: 'Legitimate check-in',
      timestamp: Timestamp.now(),
    });
    await setDoc(doc(adminDb, 'witnessInvites', 'inv_existing_1'), {
      commitmentId: 'c_existing_1',
      fromUserId: 'owner_uid_1',
      toEmail: 'intended_witness@example.com',
      status: 'pending',
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(adminDb, 'users', 'attacker_uid_1'), {
      uid: 'attacker_uid_1',
      displayName: 'Attacker User',
      email: 'attacker@example.com',
      avatarUrl: null,
      createdAt: Timestamp.now(),
    });
  });

  console.log('\n--- EXECUTING DIRTY DOZEN MALICIOUS PAYLOAD ASSERTIONS ---');
  const { DIRTY_DOZEN_TEST_SUITE } = await import('../firestore.rules.test.ts');
  let ddIndex = 15;
  for (const dd of DIRTY_DOZEN_TEST_SUITE) {
    await recordTest(ddIndex++, `[${dd.id}] ${dd.name}`, async () => {
      const authCtx = dd.auth
        ? testEnv.authenticatedContext(dd.auth.uid, { email: dd.auth.email })
        : testEnv.unauthenticatedContext();
      const firestore = authCtx.firestore();
      const docRef = doc(firestore, dd.path);

      if (dd.operation === 'create') {
        await assertFails(setDoc(docRef, dd.payload));
      } else if (dd.operation === 'update') {
        await assertFails(updateDoc(docRef, dd.payload));
      } else if (dd.operation === 'delete') {
        await assertFails(deleteDoc(docRef));
      } else if (dd.operation === 'get') {
        await assertFails(getDoc(docRef));
      }
    });
  }

  console.log('\n------------------------------------------------------------------------');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`EMULATOR TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED, TOTAL: ${results.length}`);
  console.log('------------------------------------------------------------------------\n');

  await testEnv.cleanup();

  if (failedCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error running emulator security tests:', err);
  process.exit(1);
});
