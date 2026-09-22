import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Users,
  Plus,
  Shield,
  Target,
  ArrowLeft,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useCircles } from '../hooks/useCircles.ts';
import { useChallenges } from '../hooks/useChallenges.ts';
import CircleMemberList from '../components/circles/CircleMemberList.tsx';
import ChallengeCard from '../components/circles/ChallengeCard.tsx';
import StartChallengeModal from '../components/circles/StartChallengeModal.tsx';

export default function CircleDetail() {
  const { id: paramCircleId } = useParams<{ id?: string }>();
  const { user } = useAuth();

  // If no ID in route, user is viewing the circles index
  const {
    circles,
    activeCircle,
    members,
    pendingInvites,
    loading: circlesLoading,
    error: circlesError,
    createCircle,
    inviteMember,
    acceptCircleInvite,
    declineCircleInvite,
  } = useCircles(paramCircleId);

  const activeCircleId = paramCircleId || (circles.length === 1 ? circles[0].id : undefined);

  const {
    challenges,
    participants,
    participantCommitments,
    loading: challengesLoading,
    error: challengesError,
    startChallenge,
  } = useChallenges(activeCircleId);

  // Modals & form state
  const [showCreateCircle, setShowCreateCircle] = useState(false);
  const [newCircleName, setNewCircleName] = useState('');
  const [isCreatingCircle, setIsCreatingCircle] = useState(false);
  const [createCircleError, setCreateCircleError] = useState<string | null>(null);

  const [showStartChallenge, setShowStartChallenge] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const displayedCircle = activeCircle || circles.find((c) => c.id === activeCircleId);
  const isOwner = displayedCircle?.ownerId === user?.uid;

  const handleCreateCircleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCircleName.trim()) return;

    setIsCreatingCircle(true);
    setCreateCircleError(null);
    try {
      await createCircle(newCircleName.trim());
      setNewCircleName('');
      setShowCreateCircle(false);
      setActionSuccess('Circle created successfully');
    } catch (err: any) {
      setCreateCircleError(err.message || 'Failed to create circle');
    } finally {
      setIsCreatingCircle(false);
    }
  };

  const handleAcceptInvite = async (inviteId: string, circleId: string) => {
    setActionError(null);
    try {
      await acceptCircleInvite(inviteId, circleId);
      setActionSuccess('You joined the circle!');
    } catch (err: any) {
      setActionError(err.message || 'Failed to accept invitation');
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    setActionError(null);
    try {
      await declineCircleInvite(inviteId);
      setActionSuccess('Invitation declined');
    } catch (err: any) {
      setActionError(err.message || 'Failed to decline invitation');
    }
  };

  return (
    <div id="page-circle-detail" className="p-4 space-y-6">
      {/* Global Alerts */}
      {actionError && (
        <div id="circle-action-error" className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-500 hover:text-red-700 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionSuccess && (
        <div id="circle-action-success" className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-500 hover:text-emerald-700 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pending Invitations Banner */}
      {pendingInvites.length > 0 && (
        <div id="pending-circle-invites-banner" className="p-3.5 bg-neutral-50 rounded-[12px] border border-neutral-200 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
            <Mail className="w-4 h-4 text-[#3F7D5C]" />
            <span>Pending Circle Invitations ({pendingInvites.length})</span>
          </div>

          <div className="space-y-2">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                id={`invite-item-${invite.id}`}
                className="p-2.5 bg-white border border-neutral-200 rounded-lg flex items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-semibold text-neutral-900">{invite.circleName}</span>
                  <p className="text-[11px] text-neutral-500">Invited by circle member</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    id={`btn-accept-invite-${invite.id || 'unknown'}`}
                    type="button"
                    onClick={() => invite.id && handleAcceptInvite(invite.id, invite.circleId)}
                    className="min-h-[36px] px-2.5 py-1 text-xs font-semibold text-white bg-[#3F7D5C] hover:bg-[#34684c] rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-none"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Join</span>
                  </button>
                  <button
                    id={`btn-decline-invite-${invite.id || 'unknown'}`}
                    type="button"
                    onClick={() => invite.id && handleDeclineInvite(invite.id)}
                    className="min-h-[36px] px-2.5 py-1 text-xs font-semibold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <XCircle className="w-3 h-3" />
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading state: Circle details skeleton */}
      {circlesLoading && (
        <div id="circles-loading-skeleton" className="space-y-4 animate-pulse">
          <div className="p-4 rounded-[12px] border border-neutral-200 bg-white space-y-2.5">
            <div className="h-6 bg-neutral-200 rounded w-1/3" />
            <div className="h-3 bg-neutral-100 rounded w-1/2" />
          </div>
          <div className="p-4 rounded-[12px] border border-neutral-200 bg-white space-y-3">
            <div className="h-4 bg-neutral-200 rounded w-1/4" />
            <div className="h-20 bg-neutral-50 rounded-lg" />
          </div>
        </div>
      )}

      {/* View 1: If user has no active circle selected and no circles exist */}
      {!displayedCircle && !circlesLoading && circles.length === 0 && (
        <div id="circles-empty-state" className="p-6 text-center rounded-[12px] border border-dashed border-neutral-200 bg-white space-y-4 shadow-none">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#3F7D5C]/10 text-[#3F7D5C] flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-lg font-bold text-neutral-900">
              Accountability Circles
            </h2>
            <p className="text-xs text-neutral-600 max-w-sm mx-auto leading-relaxed">
              Form intimate circles of up to 10 trusted companions to share group challenges and hold each other mutually accountable.
            </p>
          </div>

          <button
            id="btn-create-first-circle"
            type="button"
            onClick={() => setShowCreateCircle(true)}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#3F7D5C] hover:bg-[#34684c] rounded-lg transition-colors cursor-pointer shadow-none"
          >
            <Plus className="w-4 h-4" />
            <span>Create a Circle</span>
          </button>
        </div>
      )}

      {/* View 2: User has multiple circles, and is on `/circles` selector */}
      {!paramCircleId && !circlesLoading && circles.length > 1 && (
        <div id="circles-selector-section" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold text-neutral-900">Your Circles</h2>
            <button
              id="btn-create-another-circle"
              type="button"
              onClick={() => setShowCreateCircle(true)}
              className="text-xs font-semibold text-[#3F7D5C] hover:text-[#34684c] flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Circle</span>
            </button>
          </div>

          <div className="grid gap-2">
            {circles.map((c) => (
              <Link
                key={c.id}
                id={`circle-card-${c.id}`}
                to={`/circles/${c.id}`}
                className="p-3.5 bg-white border border-neutral-200 hover:border-neutral-300 rounded-[12px] flex items-center justify-between transition-colors shadow-none"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-700 font-serif font-bold text-xs">
                    {(c.name[0] || 'C').toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-medium text-xs text-neutral-900">{c.name}</h3>
                    <span className="text-[11px] text-neutral-500">{c.memberCount || 1} / 10 members</span>
                  </div>
                </div>
                <span className="text-xs text-[#3F7D5C] font-semibold">Open &rarr;</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* View 3: Active Circle View */}
      {displayedCircle && (
        <div id="active-circle-view" className="space-y-6">
          {/* Top Bar with Circle Info */}
          <div className="flex items-start justify-between gap-3 pt-1 border-b border-neutral-200 pb-4">
            <div className="space-y-1">
              {circles.length > 1 && (
                <Link
                  id="link-back-to-circles"
                  to="/circles"
                  className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-800"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>All Circles</span>
                </Link>
              )}
              <div className="flex items-center gap-2">
                <h1 id="circle-title" className="font-serif text-2xl font-bold text-neutral-900 tracking-tight">
                  {displayedCircle.name}
                </h1>
                {isOwner && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <Shield className="w-3 h-3 text-emerald-600" />
                    Owner
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500">
                Shared accountability circle • Maximum 10 members
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                id="btn-start-challenge-top"
                type="button"
                onClick={() => setShowStartChallenge(true)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#3F7D5C] hover:bg-[#34684c] rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Target className="w-3.5 h-3.5" />
                <span>Start Challenge</span>
              </button>
            </div>
          </div>

          {/* Group Challenges Section */}
          <div id="section-group-challenges" className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-neutral-700" />
                <h2 className="font-serif text-base font-bold text-neutral-900">
                  Circle Challenges
                </h2>
                <span className="text-[11px] font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                  {challenges.length}
                </span>
              </div>
            </div>

            {challengesLoading && (
              <div id="challenges-loading-skeleton" className="space-y-3 animate-pulse">
                {[1, 2].map((i) => (
                  <div key={i} className="p-4 bg-white border border-neutral-200 rounded-[12px] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-neutral-200 rounded w-1/3" />
                      <div className="h-3 bg-neutral-100 rounded w-16" />
                    </div>
                    <div className="h-2.5 bg-neutral-100 rounded w-3/4" />
                    <div className="h-2 bg-neutral-100 rounded-full w-full mt-2" />
                  </div>
                ))}
              </div>
            )}

            {!challengesLoading && challenges.length === 0 && (
              <div
                id="empty-challenges-state"
                className="p-6 text-center bg-white border border-dashed border-neutral-200 rounded-[12px] space-y-2"
              >
                <p className="font-serif text-sm font-semibold text-neutral-800">
                  No group challenges started yet
                </p>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
                  Start a challenge to embark on synchronized daily or weekly habits with everyone in your circle.
                </p>
                <button
                  id="btn-start-first-challenge"
                  type="button"
                  onClick={() => setShowStartChallenge(true)}
                  className="mt-2 min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#3F7D5C] bg-white border border-[#3F7D5C]/30 hover:bg-[#3F7D5C]/5 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Start Challenge</span>
                </button>
              </div>
            )}

            {!challengesLoading && challenges.length > 0 && (
              <div id="challenges-list" className="space-y-3">
                {challenges.map((c) => (
                  <ChallengeCard
                    key={c.id}
                    challenge={c}
                    currentUserId={user?.uid || ''}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Circle Members Section */}
          <div id="section-circle-members" className="pt-4 border-t border-neutral-200">
            <CircleMemberList
              circle={displayedCircle}
              members={members}
              isOwner={isOwner}
              onInvite={(email) => inviteMember(displayedCircle.id || '', displayedCircle.name, email)}
            />
          </div>
        </div>
      )}

      {/* Modal: Create Circle */}
      {showCreateCircle && (
        <div
          id="modal-create-circle-backdrop"
          className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setShowCreateCircle(false)}
        >
          <div
            id="modal-create-circle"
            className="w-full max-w-[480px] sm:max-w-[400px] bg-white rounded-t-[20px] sm:rounded-2xl border border-neutral-200 shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto pb-safe animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle indicator */}
            <div className="w-10 h-1 rounded-full bg-neutral-300 mx-auto -mt-1 mb-2 sm:hidden" />

            <div>
              <h3 className="font-serif text-base font-bold text-neutral-900">
                Create New Circle
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Up to 10 companions for shared group challenges.
              </p>
            </div>

            <form onSubmit={handleCreateCircleSubmit} className="space-y-3">
              <input
                id="input-new-circle-name"
                type="text"
                required
                minLength={2}
                maxLength={50}
                placeholder="Circle Name (e.g. Dawn Seekers)"
                value={newCircleName}
                onChange={(e) => setNewCircleName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3F7D5C] focus:border-[#3F7D5C]"
              />

              {createCircleError && (
                <p id="create-circle-error" className="text-xs text-red-600">
                  {createCircleError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  id="btn-cancel-create-circle"
                  type="button"
                  onClick={() => setShowCreateCircle(false)}
                  className="min-h-[44px] px-3.5 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-create-circle"
                  type="submit"
                  disabled={isCreatingCircle}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-[#3F7D5C] hover:bg-[#34684c] rounded-lg disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {isCreatingCircle ? 'Creating...' : 'Create Circle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Start Challenge */}
      {displayedCircle && (
        <StartChallengeModal
          circle={displayedCircle}
          members={members}
          isOpen={showStartChallenge}
          onClose={() => setShowStartChallenge(false)}
          onStart={startChallenge}
        />
      )}
    </div>
  );
}
