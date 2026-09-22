import { useState } from 'react';
import { Checkin } from '../../types/index.ts';
import { parseTimestamp } from '../../hooks/useCommitments.ts';
import { useCheckinWitnessActions } from '../../hooks/useWitnessActions.ts';
import { useWitnessInvites } from '../../hooks/useWitnessInvites.ts';
import { deriveCheckinDisplayStatus } from '../../utils/checkinStatusUtils.ts';
import CheckinWitnessResponses from '../witnessing/CheckinWitnessResponses.tsx';

interface CheckinHistoryProps {
  checkins: Checkin[];
  loading?: boolean;
  error?: string | null;
  hasWitness?: boolean;
}

// Format date safely
const formatCheckinDate = (timestamp: any) => {
  try {
    const date = parseTimestamp(timestamp);
    if (!date) return 'Recently';
    return date.toLocaleDateString('en-US', {
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

interface CheckinHistoryItemProps {
  checkin: Checkin;
  hasWitness: boolean;
  onExpandPhoto: (url: string) => void;
}

function CheckinHistoryItem({ checkin, hasWitness, onExpandPhoto }: CheckinHistoryItemProps) {
  // Real-time witness actions for this specific check-in
  const { actions } = useCheckinWitnessActions(checkin.id);
  const { status: displayStatus, badgeStyle } = deriveCheckinDisplayStatus(actions, hasWitness);

  const dateLabel = formatCheckinDate(checkin.timestamp);
  const isPhoto = checkin.evidenceType === 'photo' && checkin.evidenceUrl;
  const isVideo = checkin.evidenceType === 'video' && checkin.evidenceUrl;

  return (
    <div
      key={checkin.id || `${checkin.timestamp}`}
      id={`checkin-item-${checkin.id}`}
      className="p-4 rounded-[12px] border border-neutral-200 bg-white space-y-3 shadow-none transition-colors"
    >
      {/* Header: Timestamp and derived human-readable status */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-neutral-500 text-[11px]">
          {dateLabel}
        </span>

        {/* Derived status badge reflecting witness actions */}
        <span
          id={`checkin-status-${checkin.id}`}
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${badgeStyle}`}
        >
          {displayStatus}
        </span>
      </div>

      {/* Note Content */}
      {checkin.note && (
        <p
          id={`checkin-note-${checkin.id}`}
          className="text-xs text-neutral-800 whitespace-pre-line leading-relaxed"
        >
          {checkin.note}
        </p>
      )}

      {/* Evidence: Photo Thumbnail */}
      {isPhoto && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => onExpandPhoto(checkin.evidenceUrl!)}
            className="group relative block overflow-hidden rounded-lg border border-neutral-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3F7D5C]"
            aria-label="View photo evidence"
          >
            <img
              src={checkin.evidenceUrl}
              alt="Check-in evidence"
              referrerPolicy="no-referrer"
              className="w-full max-h-48 object-cover group-hover:scale-[1.01] transition-transform duration-150"
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

      {/* Evidence: Video Player */}
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
              Your browser does not support playing this video.
            </video>
          </div>
          <span className="text-[10px] text-neutral-400 block text-right font-mono">
            Video evidence (MP4)
          </span>
        </div>
      )}

      {/* Witness Responses Attached to this Check-in */}
      <CheckinWitnessResponses checkinId={checkin.id} actions={actions} />
    </div>
  );
}

export default function CheckinHistory({
  checkins,
  loading = false,
  error = null,
  hasWitness: hasWitnessProp,
}: CheckinHistoryProps) {
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  // If hasWitness is not explicitly provided, derive it from commitmentInvites of the checkin's commitment
  const firstCommitmentId = checkins && checkins.length > 0 ? checkins[0].commitmentId : undefined;
  const { commitmentInvites } = useWitnessInvites(
    hasWitnessProp === undefined ? firstCommitmentId : undefined
  );

  const hasWitness =
    hasWitnessProp !== undefined
      ? hasWitnessProp
      : commitmentInvites.some((inv) => inv.status === 'accepted' || inv.status === 'pending');

  // 1. Loading State
  if (loading) {
    return (
      <div id="checkin-history-loading" className="space-y-2.5 animate-pulse">
        <div className="flex items-center justify-between pb-1">
          <div className="h-4 bg-neutral-200 rounded w-28" />
          <div className="h-3 bg-neutral-100 rounded w-20" />
        </div>
        {[1, 2].map((i) => (
          <div
            key={i}
            className="p-4 rounded-[12px] border border-neutral-200 bg-white space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 bg-neutral-100 rounded w-24" />
              <div className="h-4 bg-neutral-100 rounded-full w-20" />
            </div>
            <div className="h-3 bg-neutral-100 rounded w-3/4" />
            <div className="h-3 bg-neutral-50 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div id="checkin-history-error" className="p-4 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
        <p>{error}</p>
      </div>
    );
  }

  // 3. Empty State
  if (!checkins || checkins.length === 0) {
    return (
      <div
        id="checkin-history-empty"
        className="p-8 text-center rounded-[12px] border border-dashed border-neutral-200 bg-white"
      >
        <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mx-auto mb-2.5">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-neutral-700 mb-1">
          No check-ins yet.
        </p>
        <p className="text-xs text-neutral-400 max-w-[240px] mx-auto leading-relaxed">
          Record your first practice check-in using the button above.
        </p>
      </div>
    );
  }

  return (
    <div id="checkin-history-container" className="space-y-3">
      <div className="flex items-center justify-between pb-1">
        <h3 className="font-serif text-sm font-semibold text-neutral-900">
          Check-in History
        </h3>
        <span className="text-[11px] text-neutral-400 font-mono">
          Showing latest {checkins.length}
        </span>
      </div>

      <div className="space-y-2.5">
        {checkins.map((checkin) => (
          <CheckinHistoryItem
            key={checkin.id || `${checkin.timestamp}`}
            checkin={checkin}
            hasWitness={hasWitness}
            onExpandPhoto={setSelectedPhotoUrl}
          />
        ))}
      </div>

      {/* Photo Lightbox Modal */}
      {selectedPhotoUrl && (
        <div
          id="modal-photo-lightbox"
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setSelectedPhotoUrl(null)}
        >
          <div
            className="relative max-w-2xl max-h-[90vh] bg-white rounded-lg overflow-hidden border border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              id="btn-close-lightbox"
              type="button"
              onClick={() => setSelectedPhotoUrl(null)}
              className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
              aria-label="Close photo"
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

