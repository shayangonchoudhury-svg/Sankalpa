/**
 * firestore.rules.test.ts
 *
 * Test suite verifying that all "Dirty Dozen" malicious and invalid payloads
 * are strictly rejected by the SANKALPA Firestore security rules with PERMISSION_DENIED.
 */

export interface TestPayloadAssertion {
  id: string;
  name: string;
  path: string;
  operation: 'create' | 'update' | 'delete' | 'get' | 'list';
  auth: { uid: string; email?: string } | null;
  payload: Record<string, any>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TEST_SUITE: TestPayloadAssertion[] = [
  {
    id: 'DD-01',
    name: 'Identity Spoofing on Commitment Creation',
    path: 'commitments/c_malicious_1',
    operation: 'create',
    auth: { uid: 'attacker_uid_1', email: 'attacker@example.com' },
    payload: {
      ownerId: 'victim_user_123', // Spoofed UID
      title: 'Hacked Commitment',
      cadence: 'daily',
      visibility: 'private',
      archived: false,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02',
    name: 'Ghost Field / Shadow Update Attack on Commitment',
    path: 'commitments/c_existing_1',
    operation: 'update',
    auth: { uid: 'owner_uid_1', email: 'owner@example.com' },
    payload: {
      title: 'Updated Title',
      isVerified: true, // Ghost field
      role: 'admin',    // Ghost field
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03',
    name: 'Immutable Field Mutation on Commitment (ownerId & createdAt)',
    path: 'commitments/c_existing_1',
    operation: 'update',
    auth: { uid: 'owner_uid_1', email: 'owner@example.com' },
    payload: {
      ownerId: 'new_transferred_owner_uid', // Cannot mutate ownerId
      title: 'Valid Title',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    name: 'Check-in on Foreign Commitment (Check-in Hijacking)',
    path: 'checkins/chk_malicious_1',
    operation: 'create',
    auth: { uid: 'attacker_uid_1', email: 'attacker@example.com' },
    payload: {
      commitmentId: 'victim_commitment_999', // Owned by someone else
      userId: 'attacker_uid_1',
      evidenceType: 'text',
      note: 'Hijacked check-in note',
      status: 'pending',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    name: 'Orphan Check-in Reference (Non-existent commitmentId)',
    path: 'checkins/chk_malicious_2',
    operation: 'create',
    auth: { uid: 'practitioner_uid_1', email: 'practitioner@example.com' },
    payload: {
      commitmentId: 'non_existent_commitment_000',
      userId: 'practitioner_uid_1',
      evidenceType: 'photo',
      evidenceUrl: 'https://example.com/photo.jpg',
      status: 'pending',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    name: 'Unauthorized Check-in Status Override (Attempting to mark verified)',
    path: 'checkins/chk_existing_1',
    operation: 'update',
    auth: { uid: 'practitioner_uid_1', email: 'practitioner@example.com' },
    payload: {
      status: 'verified', // Client cannot update checkins directly
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    name: 'Unverified Witness Action Submission (Not an accepted witness)',
    path: 'witnessActions/act_malicious_1',
    operation: 'create',
    auth: { uid: 'stranger_uid_1', email: 'stranger@example.com' },
    payload: {
      checkinId: 'chk_existing_1',
      witnessId: 'stranger_uid_1',
      responseType: 'approved',
      note: 'I am not an accepted witness',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    name: 'Witness Identity Spoofing in WitnessAction',
    path: 'witnessActions/act_malicious_2',
    operation: 'create',
    auth: { uid: 'attacker_uid_1', email: 'attacker@example.com' },
    payload: {
      checkinId: 'chk_existing_1',
      witnessId: 'real_witness_uid_555', // Impersonating another witness
      responseType: 'approved',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09',
    name: 'Self-Witnessing Invitation Creation',
    path: 'witnessInvites/inv_malicious_1',
    operation: 'create',
    auth: { uid: 'owner_uid_1', email: 'owner@example.com' },
    payload: {
      commitmentId: 'c_existing_1',
      fromUserId: 'owner_uid_1',
      toEmail: 'owner@example.com', // Sending invite to self
      status: 'pending',
      toUserId: null,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    name: 'Invitation Interception / Acceptance Hijack by Non-Recipient',
    path: 'witnessInvites/inv_existing_1',
    operation: 'update',
    auth: { uid: 'attacker_uid_1', email: 'attacker@example.com' }, // Not the invited email
    payload: {
      status: 'accepted',
      toUserId: 'attacker_uid_1',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    name: 'Denial-of-Wallet String Bomb Attack',
    path: 'commitments/c_malicious_2',
    operation: 'create',
    auth: { uid: 'attacker_uid_1', email: 'attacker@example.com' },
    payload: {
      ownerId: 'attacker_uid_1',
      title: 'A'.repeat(5000), // Exceeds max 100 characters limit
      cadence: 'daily',
      visibility: 'private',
      archived: false,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    name: 'Privilege Escalation via User Profile Injection',
    path: 'users/attacker_uid_1',
    operation: 'update',
    auth: { uid: 'attacker_uid_1', email: 'attacker@example.com' },
    payload: {
      displayName: 'Attacker User',
      role: 'admin',     // Forbidden field
      isVerified: true,  // Forbidden field
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
