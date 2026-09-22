import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useWitnessInvites } from '../hooks/useWitnessInvites.ts';
import { useWitnessActions } from '../hooks/useWitnessActions.ts';
import WitnessActionButtons from '../components/witnessing/WitnessActionButtons.tsx';
import { parseTimestamp } from '../hooks/useCommitments.ts';
import type { Checkin, Commitment } from '../types/index.ts';

interface InviteWithDetails {
  id: string;
  commitmentId: string;
  fromUserId: string;
  toEmail: string;
  createdAt: any;
  commitmentTitle?: string;
  inviterName?: string;
}

export default function WitnessInbox() {
  const { user } = useAuth();
  const {
    pendingReceivedInvites,
    pendingReceivedLoading,
    acceptedWitnessInvites,
    acceptedWitnessLoading,
    acceptInvite,
    declineInvite,
  } = useWitnessInvites();

  const { myRespondedCheckinIds } = useWitnessActions();

  // Detail caching for invites in Section 1
  const [invitesDetails, setInvitesDetails] = useState<Map<string, { title: string; inviter: string }>>(new Map());
  const [inviteActionLoading, setInviteActionLoading] = useState<string | null>(null);
  const [inviteActionError, setInviteActionError] = useState<string | null>(null);

  // Section 2: Actionable check-ins to review
  const [actionableCheckins, setActionableCheckins] = useState<Checkin[]>([]);
  const [checkinsLoading, setCheckinsLoading] = useState(true);
  const [commitmentsMap, setCommitmentsMap] = useState<Map<string, { title: string; ownerName?: string }>>(new Map());

  // Lightbox for photo evidence
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  // Fetch details (commitment title, inviter name) for pending invites
  useEffect(() => {
    if (pendingReceivedInvites.length === 0) {
      setInvitesDetails(new Map());
      return;
    }

    let isMounted = true;

    async function loadInviteDetails() {
      const detailsMap = new Map<string, { title: string; inviter: string }>();

      for (const invite of pendingReceivedInvites) {
        let title = 'Commitment';
        let inviter = 'A practitioner';

        try {
          if (invite.commitmentId) {
            const cSnap = await getDoc(doc(db, 'commitments', invite.commitmentId));
            if (cSnap.exists()) {
              title = cSnap.data().title || 'Commitment';
            }
          }
          if (invite.fromUserId) {
            const uSnap = await getDoc(doc(db, 'users', invite.fromUserId));
            if (uSnap.exists()) {
              inviter = uSnap.data().displayName || uSnap.data().email || 'A practitioner';
            }
          }
        } catch (err) {
          console.error('Error resolving invite details:', err);
        }

        if (invite.id) {
          detailsMap.set(invite.id, { title, inviter });
        }
      }

      if (isMounted) {
        setInvitesDetails(detailsMap);
      }
    }

    loadInviteDetails();

    return () => {
      isMounted = false;
    };
  }, [pendingReceivedInvites]);

  // Section 2: Real-time listener for check-ins from accepted witness commitments
  useEffect(() => {
    if (acceptedWitnessLoading) return;

    const acceptedCommitmentIds = Array.from(
      new Set(acceptedWitnessInvites.map((inv) => inv.commitmentId).filter(Boolean))
    );

    if (acceptedCommitmentIds.length === 0) {
      setActionableCheckins([]);
      setCheckinsLoading(false);
      return;
    }

    setCheckinsLoading(true);

    // Fetch commitment metadata for labels (up to 30 bounded)
    const boundedCommitmentIds = acceptedCommitmentIds.slice(0, 30);
    boundedCommitmentIds.forEach(async (cId) => {
      try {
        const cSnap = await getDoc(doc(db, 'commitments', cId));
        if (cSnap.exists()) {
          const cData = cSnap.data();
          let ownerName = 'Practitioner';
          if (cData.ownerId) {
            const uSnap = await getDoc(doc(db, 'users', cData.ownerId));
            if (uSnap.exists()) {
              ownerName = uSnap.data().displayName || uSnap.data().email || 'Practitioner';
            }
          }
          setCommitmentsMap((prev) => {
            const next = new Map(prev);
            next.set(cId, { title: cData.title || 'Commitment', ownerName });
            return next;
          });
        }
      } catch (e) {
        console.error('Error fetching commitment metadata:', e);
      }
    });

    // Query check-ins per accepted commitment with deterministic equality constraint
    // (compatible with Firestore Security Rules isAcceptedWitness evaluation)
    const itemsPerCommitment = new Map<string, Checkin[]>();
    const unsubs: (() => void)[] = [];

    const recomputeAll = () => {
      const allItems: Checkin[] = [];
      itemsPerCommitment.forEach((items) => {
        allItems.push(...items);
      });

      // Filter: only pending check-ins where current witness has NOT already responded
      const filtered = allItems.filter(
        (chk) => chk.status === 'pending' && !myRespondedCheckinIds.has(chk.id || '')
      );

      // Sort newest first
      filtered.sort((a, b) => {
        const timeA = parseTimestamp(a.timestamp)?.getTime() || 0;
        const timeB = parseTimestamp(b.timestamp)?.getTime() || 0;
        return timeB - timeA;
      });

      // Cap at 20 actionable items (no infinite scroll)
      setActionableCheckins(filtered.slice(0, 20));
      setCheckinsLoading(false);
    };

    boundedCommitmentIds.forEach((cId) => {
      const q = query(
        collection(db, 'checkins'),
        where('commitmentId', '==', cId)
      );

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const list: Checkin[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              commitmentId: data.commitmentId,
              userId: data.userId,
              evidenceType: data.evidenceType || 'none',
              evidenceUrl: data.evidenceUrl,
              note: data.note,
              timestamp: data.timestamp,
              status: data.status,
            });
          });
          itemsPerCommitment.set(cId, list);
          recomputeAll();
        },
        (err) => {
          console.error(`Error fetching check-ins for commitment ${cId}:`, err);
          itemsPerCommitment.delete(cId);
          recomputeAll();
        }
      );
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [acceptedWitnessInvites, acceptedWitnessLoading, myRespondedCheckinIds]);

  const handleAcceptInvite = async (inviteId: string) => {
    setInviteActionLoading(inviteId);
    setInviteActionError(null);
    try {
      await acceptInvite(inviteId);
    } catch (err: any) {
      console.error('Accept invite error:', err);
      setInviteActionError(err?.message || 'Failed to accept invitation.');
    } finally {
      setInviteActionLoading(null);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    setInviteActionLoading(inviteId);
    setInviteActionError(null);
    try {
      await declineInvite(inviteId);
    } catch (err: any) {
      console.error('Decline invite error:', err);
      setInviteActionError(err?.message || 'Failed to decline invitation.');
    } finally {
      setInviteActionLoading(null);
    }
  };

  const formatTimestamp = (ts: any) => {
    try {
      const d = parseTimestamp(ts);
      if (!d) return 'Recently';
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div id="page-witness-inbox" className="p-4 space-y-6 max-w-[480px] mx-auto">
      {/* Header */}
      <div className="space-y-1 pb-2 border-b border-neutral-200">
        <h1 className="font-serif text-2xl font-bold text-neutral-900 tracking-tight">
          Witness Inbox
        </h1>
        <p className="text-xs text-neutral-500">
          Review practice check-ins and respond to invitations for commitments you witness.
        </p>
      </div>

      {inviteActionError && (
        <div className="p-3 rounded-[12px] border border-red-200 bg-red-50 text-xs text-red-700">
          {inviteActionError}
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 1: Invites waiting for your response            */}
      {/* ======================================================== */}
      <section id="section-witness-pending-invites" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-base font-semibold text-neutral-900">
            Invites waiting for your response
          </h2>
          {pendingReceivedInvites.length > 0 && (
            <span className="text-[11px] font-mono text-neutral-400">
              {pendingReceivedInvites.length} pending
            </span>
          )}
        </div>

        {pendingReceivedLoading ? (
          <div id="invites-loading-skeleton" className="space-y-2.5 animate-pulse">
            <div className="p-4 rounded-[12px] border border-neutral-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="h-3.5 bg-neutral-200 rounded w-1/3" />
                <div className="h-2.5 bg-neutral-100 rounded w-1/2" />
              </div>
              <div className="flex gap-2">
                <div className="w-16 h-8 bg-neutral-100 rounded-lg" />
                <div className="w-16 h-8 bg-neutral-200 rounded-lg" />
              </div>
            </div>
          </div>
        ) : pendingReceivedInvites.length === 0 ? (
          <div
            id="invites-empty-state"
            className="p-5 rounded-[12px] border border-dashed border-neutral-200 bg-white text-center"
          >
            <p className="text-xs text-neutral-500">No invitations waiting for your response.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingReceivedInvites.map((invite) => {
              const details = (invite.id && invitesDetails.get(invite.id)) || {
                title: 'Commitment',
                inviter: 'A practitioner',
              };
              const dateLabel = formatTimestamp(invite.createdAt);
              const isProcessing = inviteActionLoading === invite.id;

              return (
                <div
                  key={invite.id}
                  id={`invite-item-${invite.id}`}
                  className="p-4 rounded-[12px] border border-neutral-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-none"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-neutral-900">
                        {details.title}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
                        Invitation
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500">
                      From <span className="font-medium text-neutral-700">{details.inviter}</span>
                      <span className="text-neutral-400"> • {dateLabel}</span>
                    </p>
                  </div>

                  {/* Accept / Decline actions with min 44px tap targets */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      id={`btn-decline-invite-${invite.id}`}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => invite.id && handleDeclineInvite(invite.id)}
                      className="min-h-[44px] px-3.5 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                    >
                      Decline
                    </button>
                    <button
                      id={`btn-accept-invite-${invite.id}`}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => invite.id && handleAcceptInvite(invite.id)}
                      className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-[#3F7D5C] hover:bg-[#34684c] disabled:opacity-50 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-none"
                    >
                      {isProcessing ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <span>Accept</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* SECTION 2: Check-ins to review                           */}
      {/* ======================================================== */}
      <section id="section-witness-checkins-to-review" className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-base font-semibold text-neutral-900">
            Check-ins to review
          </h2>
          {actionableCheckins.length > 0 && (
            <span className="text-[11px] font-mono text-neutral-400">
              Showing latest {actionableCheckins.length}
            </span>
          )}
        </div>

        {checkinsLoading ? (
          <div id="checkins-review-skeleton" className="space-y-3 animate-pulse">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="p-4 rounded-[12px] border border-neutral-200 bg-white space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5 w-1/2">
                    <div className="h-3.5 bg-neutral-200 rounded w-3/4" />
                    <div className="h-2.5 bg-neutral-100 rounded w-1/2" />
                  </div>
                  <div className="h-2.5 bg-neutral-100 rounded w-14" />
                </div>
                <div className="h-10 bg-neutral-50 rounded-lg border border-neutral-100" />
                <div className="flex gap-2 pt-1">
                  <div className="w-20 h-9 bg-neutral-200 rounded-lg" />
                  <div className="w-24 h-9 bg-neutral-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : actionableCheckins.length === 0 ? (
          <div
            id="witness-checkins-empty-state"
            className="p-8 text-center rounded-[12px] border border-dashed border-neutral-200 bg-white space-y-1.5"
          >
            <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mx-auto mb-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-serif text-sm font-semibold text-neutral-800">You're all caught up</p>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto">
              There are no pending check-ins requiring your review right now.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {actionableCheckins.map((checkin) => {
              const cInfo = commitmentsMap.get(checkin.commitmentId) || {
                title: 'Commitment',
                ownerName: 'Practitioner',
              };
              const dateLabel = formatTimestamp(checkin.timestamp);
              const isPhoto = checkin.evidenceType === 'photo' && checkin.evidenceUrl;
              const isVideo = checkin.evidenceType === 'video' && checkin.evidenceUrl;

              return (
                <div
                  key={checkin.id}
                  id={`review-checkin-${checkin.id}`}
                  className="p-4 rounded-[12px] border border-neutral-200 bg-white space-y-3 shadow-none"
                >
                  {/* Header: Commitment title & practitioner */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-semibold text-neutral-900">
                        {cInfo.title}
                      </h3>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        By <span className="font-medium text-neutral-700">{cInfo.ownerName}</span>
                      </p>
                    </div>
                    <span className="font-mono text-neutral-400 text-[10px] shrink-0">
                      {dateLabel}
                    </span>
                  </div>

                  {/* Note */}
                  {checkin.note && (
                    <p className="text-xs text-neutral-800 whitespace-pre-line leading-relaxed bg-neutral-50/70 p-2.5 rounded-lg border border-neutral-100">
                      {checkin.note}
                    </p>
                  )}

                  {/* Photo Evidence */}
                  {isPhoto && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedPhotoUrl(checkin.evidenceUrl!)}
                        className="group relative block overflow-hidden rounded-lg border border-neutral-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3F7D5C]"
                      >
                        <img
                          src={checkin.evidenceUrl}
                          alt="Evidence"
                          referrerPolicy="no-referrer"
                          className="w-full max-h-48 object-cover group-hover:scale-[1.01] transition-transform"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-[10px] px-2 py-1 rounded">
                            Click to expand
                          </span>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Video Evidence */}
                  {isVideo && (
                    <div className="pt-1 space-y-1">
                      <div className="rounded-lg overflow-hidden border border-neutral-200 bg-black">
                        <video
                          src={checkin.evidenceUrl}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full max-h-60 object-contain mx-auto"
                        >
                          Your browser does not support video playback.
                        </video>
                      </div>
                      <span className="text-[10px] text-neutral-400 block text-right font-mono">
                        Video evidence (MP4)
                      </span>
                    </div>
                  )}

                  {/* Witness Action Buttons */}
                  <WitnessActionButtons
                    checkinId={checkin.id!}
                    checkin={checkin}
                    commitmentTitle={cInfo.title}
                    previousCheckins={actionableCheckins.filter(
                      (c) => c.commitmentId === checkin.commitmentId && c.id !== checkin.id
                    )}
                    hasAlreadyResponded={myRespondedCheckinIds.has(checkin.id!)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Photo Lightbox Modal */}
      {selectedPhotoUrl && (
        <div
          id="modal-inbox-lightbox"
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setSelectedPhotoUrl(null)}
        >
          <div
            className="relative max-w-2xl max-h-[90vh] bg-white rounded-lg overflow-hidden border border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              id="btn-close-inbox-lightbox"
              type="button"
              onClick={() => setSelectedPhotoUrl(null)}
              className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={selectedPhotoUrl}
              alt="Expanded evidence"
              referrerPolicy="no-referrer"
              className="w-auto h-auto max-h-[85vh] max-w-full object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
