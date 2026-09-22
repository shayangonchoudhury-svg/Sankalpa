# SANKALPA Firestore Security Specification & Invariants

## Data Invariants

1. **User Identity Boundary**: Every document creation requiring user authorship must bind its UID field (`ownerId`, `userId`, `fromUserId`, `witnessId`) strictly to `request.auth.uid`.
2. **Parent Reference Existence**: Child documents (`checkins`, `witnessInvites`, `commitments/{id}/witnesses/{uid}`) must reference existing parent records in Firestore.
3. **Commitment Ownership Guard**: Only the authenticated owner of a commitment may create check-ins for that commitment.
4. **Deterministic Witness Authorization**: An accepted witness must have an explicit record at `commitments/{commitmentId}/witnesses/{witnessUid}` with `status: 'accepted'` to be granted witness read/action privileges.
5. **Witness Action Integrity**: Only accepted witnesses may submit `witnessActions`. A user cannot submit witness actions on their own check-ins.
6. **Invitation Lifecycle Integrity**: Only the recipient matching `toEmail` (verified via `request.auth.token.email`) may accept or decline an invite. Only pending invites may transition to accepted or declined.
7. **Check-in Immutability**: Check-ins cannot be modified by clients once submitted. Their status remains pending, and responses are recorded in immutable `witnessActions`.
8. **Volumetric Boundaries**: String fields must enforce maximum length constraints (`title` <= 100, `note` <= 1000, `displayName` <= 40, `id` <= 128) to prevent Denial-of-Wallet attacks.
9. **Zero-Trust Default Deny**: Any collection path or operation not explicitly permitted must be rejected.

---

## The "Dirty Dozen" Malicious Payloads

1. **Payload 1: Identity Spoofing on Commitment Creation**
   - Attempt: Attacker submits `commitments` with `ownerId: "victim_user_123"`.
   - Expected: PERMISSION_DENIED.

2. **Payload 2: Ghost Field / Shadow Update Attack**
   - Attempt: User updates commitment with `{ title: "Run", isVerified: true, role: "admin" }`.
   - Expected: PERMISSION_DENIED.

3. **Payload 3: Immutable Field Mutation**
   - Attempt: Owner updates commitment attempting to change `ownerId` or `createdAt`.
   - Expected: PERMISSION_DENIED.

4. **Payload 4: Check-in on Foreign Commitment (Check-in Hijacking)**
   - Attempt: User submits `checkins` with their own `userId`, but pointing to another user's private `commitmentId`.
   - Expected: PERMISSION_DENIED.

5. **Payload 5: Orphan Check-in Reference**
   - Attempt: User submits `checkins` referencing a non-existent `commitmentId: "ghost_999"`.
   - Expected: PERMISSION_DENIED.

6. **Payload 6: Unauthorized Check-in Status Override**
   - Attempt: User or witness calls `updateDoc` on `checkins/{id}` setting `status: "verified"`.
   - Expected: PERMISSION_DENIED.

7. **Payload 7: Unverified Witness Action Submission**
   - Attempt: User who is not an accepted witness submits a `witnessActions` document for a checkin.
   - Expected: PERMISSION_DENIED.

8. **Payload 8: Witness Identity Spoofing**
   - Attempt: User submits `witnessActions` with `witnessId: "another_witness_uid"`.
   - Expected: PERMISSION_DENIED.

9. **Payload 9: Self-Witnessing Invitation Creation**
   - Attempt: Commitment owner creates a `witnessInvites` document where `toEmail` matches their own email.
   - Expected: PERMISSION_DENIED.

10. **Payload 10: Invitation Interception / Hijack**
    - Attempt: Attacker User B attempts to accept a `witnessInvites` document addressed to `userA@example.com`.
    - Expected: PERMISSION_DENIED.

11. **Payload 11: Denial-of-Wallet String Bomb**
    - Attempt: User creates commitment with a 50,000 character `title` or 100,000 character `note`.
    - Expected: PERMISSION_DENIED.

12. **Payload 12: Privilege Escalation via User Profile Injection**
    - Attempt: User creates or updates `users/{uid}` with `{ role: "admin", verified: true }`.
    - Expected: PERMISSION_DENIED.
