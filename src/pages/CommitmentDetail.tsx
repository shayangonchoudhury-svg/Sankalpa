import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useCommitments, parseTimestamp } from '../hooks/useCommitments.ts';
import { Commitment } from '../types/index.ts';
import CommitmentForm from '../components/commitments/CommitmentForm.tsx';
import CheckinForm from '../components/checkins/CheckinForm.tsx';
import CheckinHistory from '../components/checkins/CheckinHistory.tsx';
import { useCheckins } from '../hooks/useCheckins.ts';
import { useStreak } from '../hooks/useStreak.ts';
import { useWitnessInvites } from '../hooks/useWitnessInvites.ts';
import WitnessInviteModal from '../components/witnessing/WitnessInviteModal.tsx';
import HistoryTimeline from '../components/commitments/HistoryTimeline.tsx';
import { StreakMilestoneBadge } from '../components/commitments/StreakMilestoneBadge.tsx';

export default function CommitmentDetail() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { archiveCommitment } = useCommitments();

  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  // Real-time check-in history and submission for this commitment
  const {
    checkins,
    loading: checkinsLoading,
    error: checkinsError,
    createCheckin,
  } = useCheckins(commitment?.id, { unbounded: true });

  // Real-time derived streak statistics based on full history and witness approvals
  const {
    currentStreak,
    longestStreak,
    totalApprovedDays,
    loading: streakLoading,
  } = useStreak(commitment?.id, commitment?.cadence);

  // Witness invitations for this commitment
  const {
    commitmentInvites,
    commitmentInvitesLoading,
  } = useWitnessInvites(commitment?.id);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [witnessProfiles, setWitnessProfiles] = useState<Map<string, string>>(new Map());

  // Resolve display names for accepted witnesses
  useEffect(() => {
    const userIdsToFetch = commitmentInvites
      .map((inv) => inv.toUserId)
      .filter((uid): uid is string => Boolean(uid));

    if (userIdsToFetch.length === 0) return;

    let isMounted = true;
    Promise.all(
      userIdsToFetch.map(async (uid) => {
        try {
          const uSnap = await getDoc(doc(db, 'users', uid));
          if (uSnap.exists()) {
            return { uid, name: uSnap.data().displayName || '' };
          }
        } catch (err) {
          console.error('Error fetching witness user profile:', err);
        }
        return { uid, name: '' };
      })
    ).then((results) => {
      if (!isMounted) return;
      const map = new Map<string, string>();
      results.forEach((r) => {
        if (r.name) map.set(r.uid, r.name);
      });
      setWitnessProfiles(map);
    });

    return () => {
      isMounted = false;
    };
  }, [commitmentInvites]);

  // Subscribe to the specific commitment in real-time
  useEffect(() => {
    if (!id) {
      navigate('/home', { replace: true });
      return;
    }

    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setAccessDenied(false);
    setNotFound(false);

    const docRef = doc(db, 'commitments', id);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          setNotFound(true);
          setCommitment(null);
          setLoading(false);
          return;
        }

        const data = docSnap.data();

        // Security check: Must belong to current user
        if (data.ownerId !== user.uid) {
          setAccessDenied(true);
          setCommitment(null);
          setLoading(false);
          return;
        }

        setCommitment({
          id: docSnap.id,
          ownerId: data.ownerId,
          title: data.title || '',
          cadence: data.cadence || 'daily',
          visibility: data.visibility || 'private',
          circleId: data.circleId || undefined,
          createdAt: data.createdAt,
          description: data.description || '',
          archived: Boolean(data.archived),
        });
        setLoading(false);
      },
      (err) => {
        console.error('Notice fetching commitment detail from Firestore:', err);
        setNotFound(true);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id, user, navigate]);

  const handleArchive = async () => {
    if (!id) return;
    setArchiving(true);
    setArchiveError(null);

    try {
      await archiveCommitment(id);
      // Successfully archived: navigate back to /home
      navigate('/home');
    } catch (err: any) {
      console.error('Archive commitment error:', err);
      setArchiveError(err?.message || 'Failed to archive commitment. Please try again.');
      setArchiving(false);
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div id="commitment-detail-loading" className="p-6 py-16 flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-6 h-6 border-2 border-neutral-300 border-t-[#3F7D5C] rounded-full animate-spin"></div>
        <p className="text-xs text-neutral-400 font-medium">Loading commitment details...</p>
      </div>
    );
  }

  // 2. Access Denied or Not Found State
  if (accessDenied || notFound || !commitment) {
    return (
      <div id="commitment-detail-unauthorized" className="p-6 py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-500 mx-auto mb-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="font-serif text-lg font-semibold text-neutral-900 mb-1">
          Not found or access denied
        </h1>
        <p className="text-xs text-neutral-500 max-w-[260px] mx-auto mb-5 leading-relaxed">
          This commitment does not exist or you do not have permission to view it.
        </p>
        <Link
          id="link-back-home"
          to="/home"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#3F7D5C] hover:underline"
        >
          ← Return to Home
        </Link>
      </div>
    );
  }

  // Format creation date safely
  const formattedDate = (() => {
    try {
      const date = parseTimestamp(commitment.createdAt);
      if (!date) return '';
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  })();

  // Format cadence display
  const cadenceDisplay = (() => {
    if (!commitment.cadence) return 'Daily';
    if (commitment.cadence.startsWith('custom:')) {
      const detail = commitment.cadence.slice(7).trim();
      return detail ? `Custom (${detail})` : 'Custom';
    }
    return commitment.cadence.charAt(0).toUpperCase() + commitment.cadence.slice(1);
  })();

  return (
    <div id="page-commitment-detail" className="p-4 space-y-6">
      {/* Navigation breadcrumb */}
      <div className="flex items-center justify-between pt-1">
        <Link
          id="link-nav-back"
          to="/home"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Commitments</span>
        </Link>

        {commitment.archived && (
          <span
            id="badge-archived"
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-200 text-neutral-700"
          >
            Archived
          </span>
        )}
      </div>

      {/* Editing Mode View */}
      {isEditing ? (
        <div id="section-edit-commitment" className="p-4 rounded-[12px] border border-neutral-200 bg-white">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-100">
            <h2 className="font-serif text-base font-semibold text-neutral-900">
              Edit Commitment
            </h2>
            <button
              id="btn-cancel-edit-x"
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-neutral-400 hover:text-neutral-600 p-1 rounded"
              aria-label="Cancel editing"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <CommitmentForm
            mode="edit"
            initialCommitment={commitment}
            onSuccess={() => setIsEditing(false)}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      ) : (
        /* Read-Only Detail Card */
        <div
          id="card-commitment-detail"
          className="p-5 rounded-[12px] border border-neutral-200 bg-white space-y-4 shadow-none"
        >
          {/* Title and Cadence */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <h1
                id="commitment-detail-title"
                className="font-serif text-xl sm:text-2xl font-bold text-neutral-900 leading-tight"
              >
                {commitment.title}
              </h1>
              <span
                id="commitment-detail-cadence"
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200/80 shrink-0"
              >
                {cadenceDisplay}
              </span>
            </div>

            {formattedDate && (
              <p className="text-xs text-neutral-400 font-mono">
                Initiated on {formattedDate}
              </p>
            )}
          </div>

          {/* Description Section */}
          {commitment.description ? (
            <div className="pt-3 border-t border-neutral-100">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                Intention
              </h2>
              <p
                id="commitment-detail-description"
                className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line"
              >
                {commitment.description}
              </p>
            </div>
          ) : (
            <div className="pt-3 border-t border-neutral-100">
              <p className="text-xs text-neutral-400 italic">No description provided.</p>
            </div>
          )}

          {/* Practice Continuity & Streak Statistics */}
          <div className="pt-3 border-t border-neutral-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 font-medium">Practice Continuity</span>
              <div
                id="commitment-detail-streak"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  currentStreak >= 7
                    ? 'bg-[#3F7D5C]/10 text-[#3F7D5C] border border-[#3F7D5C]/20'
                    : 'bg-neutral-100 text-neutral-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    currentStreak >= 7
                      ? 'bg-[#3F7D5C]'
                      : currentStreak > 0
                      ? 'bg-neutral-500'
                      : 'bg-neutral-300'
                  }`}
                />
                <span>
                  {streakLoading
                    ? 'Calculating...'
                    : `${currentStreak} ${
                        commitment.cadence === 'weekly' ? 'week' : 'day'
                      } current streak`}
                </span>
              </div>

              {!streakLoading && currentStreak >= 7 && (
                <StreakMilestoneBadge
                  commitmentId={id}
                  streak={currentStreak}
                  cadence={commitment.cadence}
                  size="sm"
                />
              )}
            </div>

            {/* Structured Streak Metrics Grid */}
            <div
              id="commitment-detail-streak-metrics"
              className="grid grid-cols-3 gap-2 pt-1 text-center"
            >
              <div
                id="metric-current-streak"
                className="p-2 rounded-lg bg-neutral-50/70 border border-neutral-100"
              >
                <div className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono">
                  Current
                </div>
                <div className="text-sm font-semibold text-neutral-900 mt-0.5">
                  {streakLoading
                    ? '—'
                    : `${currentStreak} ${
                        commitment.cadence === 'weekly' ? 'w' : 'd'
                      }`}
                </div>
              </div>

              <div
                id="metric-longest-streak"
                className="p-2 rounded-lg bg-neutral-50/70 border border-neutral-100"
              >
                <div className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono">
                  Longest
                </div>
                <div className="text-sm font-semibold text-neutral-900 mt-0.5">
                  {streakLoading
                    ? '—'
                    : `${longestStreak} ${
                        commitment.cadence === 'weekly' ? 'w' : 'd'
                      }`}
                </div>
              </div>

              <div
                id="metric-completed-days"
                className="p-2 rounded-lg bg-neutral-50/70 border border-neutral-100"
              >
                <div className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono">
                  Completed
                </div>
                <div className="text-sm font-semibold text-neutral-900 mt-0.5">
                  {streakLoading
                    ? '—'
                    : `${totalApprovedDays} ${
                        commitment.cadence === 'weekly' ? 'w' : 'd'
                      }`}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons: Check in, Edit and Archive */}
          <div className="pt-4 border-t border-neutral-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {!commitment.archived ? (
              <>
                <button
                  id="btn-open-checkin"
                  type="button"
                  onClick={() => setIsCheckingIn((prev) => !prev)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#3F7D5C] hover:bg-[#34684c] rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-none order-first sm:order-none"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{isCheckingIn ? 'Close Check-in' : 'Check in'}</span>
                </button>

                <div className="flex items-center justify-end gap-2">
                  <button
                    id="btn-edit-commitment"
                    type="button"
                    onClick={() => {
                      setIsEditing(true);
                      setIsCheckingIn(false);
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-neutral-700 hover:text-neutral-900 border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer"
                  >
                    Edit
                  </button>

                  <button
                    id="btn-archive-commitment"
                    type="button"
                    onClick={() => setShowArchiveConfirm(true)}
                    className="px-3 py-2 text-xs font-medium text-neutral-500 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    Archive
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full text-center py-1">
                <p className="text-xs text-neutral-400 italic">
                  This commitment is archived and hidden from your active list.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Witnesses & Accountability Section */}
      <div
        id="section-commitment-witnesses"
        className="p-5 rounded-[16px] border border-neutral-200 bg-white space-y-3.5 shadow-none"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h3 className="font-serif text-sm font-semibold text-neutral-900">
              Witnesses & Accountability
            </h3>
            <p className="text-[11px] text-neutral-400">
              People invited to review and hold this commitment
            </p>
          </div>

          {commitment.ownerId === user?.uid && !commitment.archived && (
            <button
              id="btn-invite-witness"
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="min-h-[44px] px-3.5 py-2 text-xs font-semibold text-[#3F7D5C] hover:text-[#34684c] border border-[#3F7D5C]/30 hover:border-[#3F7D5C] hover:bg-[#3F7D5C]/5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 self-start sm:self-auto"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Invite a witness</span>
            </button>
          )}
        </div>

        {commitmentInvitesLoading ? (
          <div className="py-2 text-xs text-neutral-400">Loading witnesses...</div>
        ) : commitmentInvites.length === 0 ? (
          <div
            id="witnesses-empty-state"
            className="p-4 rounded-[10px] border border-dashed border-neutral-200 bg-neutral-50/50 text-center"
          >
            <p className="text-xs text-neutral-500">No witnesses invited yet.</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Invite a trusted friend or peer to witness your practice.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {commitmentInvites.map((inv) => {
              const displayName = inv.toUserId ? witnessProfiles.get(inv.toUserId) : null;
              const isAccepted = inv.status === 'accepted';
              const isPending = inv.status === 'pending';

              return (
                <div
                  key={inv.id}
                  id={`witness-invite-item-${inv.id}`}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-800 truncate">
                        {displayName || inv.toEmail}
                      </span>
                      {displayName && (
                        <span className="text-neutral-400 text-[11px] truncate">
                          ({inv.toEmail})
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    id={`witness-status-${inv.id}`}
                    className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize ${
                      isAccepted
                        ? 'bg-[#3F7D5C]/10 text-[#3F7D5C] border-[#3F7D5C]/20'
                        : isPending
                        ? 'bg-neutral-100 text-neutral-600 border-neutral-200'
                        : 'bg-neutral-100 text-neutral-400 border-neutral-200'
                    }`}
                  >
                    {inv.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Witness Invite Modal */}
      {showInviteModal && (
        <WitnessInviteModal
          commitmentId={commitment.id!}
          commitmentTitle={commitment.title}
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {/* Check-in Form (Collapsible / Modal section) */}
      {isCheckingIn && !commitment.archived && (
        <div id="section-checkin-form" className="animate-in fade-in duration-150">
          <CheckinForm
            commitmentId={commitment.id!}
            commitmentOwnerId={commitment.ownerId}
            commitmentTitle={commitment.title}
            commitmentCadence={commitment.cadence}
            onSubmit={(note, file) => createCheckin(note, file, commitment.ownerId)}
            onSuccess={() => setIsCheckingIn(false)}
            onCancel={() => setIsCheckingIn(false)}
          />
        </div>
      )}

      {/* Reflection Timeline (bounded to latest 30 check-ins) */}
      <div id="section-commitment-history-timeline" className="pt-2">
        <HistoryTimeline
          checkins={checkins}
          loading={checkinsLoading}
        />
      </div>

      {/* Check-in History for this specific commitment */}
      <div id="section-commitment-checkin-history" className="pt-2">
        <CheckinHistory
          checkins={checkins}
          loading={checkinsLoading}
          error={checkinsError}
          hasWitness={commitmentInvites.some((inv) => inv.status === 'accepted' || inv.status === 'pending')}
        />
      </div>

      {/* Explicit Archive Confirmation Step */}
      {showArchiveConfirm && (
        <div
          id="modal-archive-confirm"
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            if (!archiving) {
              setShowArchiveConfirm(false);
              setArchiveError(null);
            }
          }}
        >
          <div
            className="bg-white rounded-t-[20px] sm:rounded-[12px] border border-neutral-200 p-5 max-w-[480px] sm:max-w-sm w-full space-y-3 shadow-xl pb-safe animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle indicator */}
            <div className="w-10 h-1 rounded-full bg-neutral-300 mx-auto -mt-1 mb-2 sm:hidden" />
            <h3 className="font-serif text-base font-bold text-neutral-900">
              Archive this commitment?
            </h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              This commitment will be soft-archived and removed from your active Home list. Its history will remain safe and accessible.
            </p>

            {archiveError && (
              <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                {archiveError}
              </p>
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                id="btn-cancel-archive"
                type="button"
                onClick={() => {
                  setShowArchiveConfirm(false);
                  setArchiveError(null);
                }}
                disabled={archiving}
                className="min-h-[44px] px-3.5 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-archive"
                type="button"
                onClick={handleArchive}
                disabled={archiving}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {archiving && (
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                )}
                <span>{archiving ? 'Archiving...' : 'Archive'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
