import { useState } from 'react';
import { useWitnessActions } from '../../hooks/useWitnessActions.ts';
import { analyzeCheckinEvidence } from '../../services/aiService.ts';
import type { Checkin, AiFlag } from '../../types/index.ts';

interface WitnessActionButtonsProps {
  checkinId: string;
  checkin?: Checkin;
  previousCheckins?: Checkin[];
  commitmentTitle?: string;
  hasAlreadyResponded?: boolean;
  previousResponse?: string;
  onActionComplete?: () => void;
}

export default function WitnessActionButtons({
  checkinId,
  checkin,
  previousCheckins = [],
  commitmentTitle,
  hasAlreadyResponded = false,
  previousResponse,
  onActionComplete,
}: WitnessActionButtonsProps) {
  const { createWitnessAction } = useWitnessActions();

  const [activePrompt, setActivePrompt] = useState<'asked_for_more' | 'flagged' | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordedResponse, setRecordedResponse] = useState<string | null>(
    previousResponse || (hasAlreadyResponded ? 'already_responded' : null)
  );

  // On-demand witness AI evidence review state (ephemeral to session)
  const [aiReviewResult, setAiReviewResult] = useState<AiFlag | null>(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [aiReviewRan, setAiReviewRan] = useState(false);

  const isPhotoEvidence = checkin?.evidenceType === 'photo' && Boolean(checkin?.evidenceUrl);

  const handleRequestAiReview = async () => {
    if (!checkin || aiReviewLoading) return;
    setAiReviewLoading(true);
    try {
      const result = await analyzeCheckinEvidence({
        checkin,
        previousCheckins,
        commitmentTitle,
      });
      setAiReviewResult(result);
      setAiReviewRan(true);
    } catch (err) {
      console.debug('AI evidence review failed:', err);
      setAiReviewResult({ flagged: false, reason: null });
      setAiReviewRan(true);
    } finally {
      setAiReviewLoading(false);
    }
  };

  const handleApproveDirectly = async () => {
    if (submitting || recordedResponse) return;
    setError(null);
    setSubmitting(true);

    try {
      await createWitnessAction(checkinId, 'approved');
      setRecordedResponse('approved');
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      console.error('Approve action error:', err);
      setError(err?.message || 'Failed to record response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePromptSubmit = async () => {
    if (!activePrompt || submitting || recordedResponse) return;
    setError(null);
    setSubmitting(true);

    try {
      await createWitnessAction(checkinId, activePrompt, note);
      setRecordedResponse(activePrompt);
      setActivePrompt(null);
      setNote('');
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      console.error('Witness action submission error:', err);
      setError(err?.message || 'Failed to record response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPrompt = () => {
    setActivePrompt(null);
    setNote('');
    setError(null);
  };

  // If already responded or just recorded a response
  if (recordedResponse) {
    let badgeText = 'Response Recorded';
    let badgeStyle = 'bg-neutral-100 text-neutral-700 border-neutral-200';

    if (recordedResponse === 'approved') {
      badgeText = '✓ Approved by you';
      badgeStyle = 'bg-[#3F7D5C]/10 text-[#3F7D5C] border-[#3F7D5C]/20';
    } else if (recordedResponse === 'asked_for_more') {
      badgeText = 'Asked for more details';
      badgeStyle = 'bg-neutral-100 text-neutral-700 border-neutral-300';
    } else if (recordedResponse === 'flagged') {
      badgeText = 'Flagged for follow-up';
      badgeStyle = 'bg-[#C26D55]/10 text-[#C26D55] border-[#C26D55]/30';
    } else if (recordedResponse === 'already_responded') {
      badgeText = 'You have already responded to this check-in';
      badgeStyle = 'bg-neutral-100 text-neutral-600 border-neutral-200';
    }

    return (
      <div
        id={`witness-action-recorded-${checkinId}`}
        className="pt-2 flex items-center justify-between"
      >
        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border ${badgeStyle}`}
        >
          {badgeText}
        </span>
      </div>
    );
  }

  return (
    <div id={`witness-actions-${checkinId}`} className="pt-2 space-y-3">
      {error && (
        <div
          id={`witness-action-error-${checkinId}`}
          className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700 leading-relaxed"
        >
          {error}
        </div>
      )}

      {/* On-Demand AI Evidence Review (Witness-Only, Spark-Compatible, Advisory) */}
      {isPhotoEvidence && !aiReviewRan && (
        <div className="flex items-center justify-between pb-1">
          <button
            id={`btn-request-ai-review-${checkinId}`}
            type="button"
            onClick={handleRequestAiReview}
            disabled={aiReviewLoading || submitting}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            {aiReviewLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-neutral-800 rounded-full animate-spin"></div>
                <span>Analyzing photo evidence...</span>
              </>
            ) : (
              <>
                <span className="text-[#3F7D5C]">✦</span>
                <span>Request AI Review</span>
              </>
            )}
          </button>
          <span className="text-[10px] text-neutral-400 font-mono">Optional advisory check</span>
        </div>
      )}

      {/* Advisory AI Review Result Display */}
      {aiReviewRan && aiReviewResult && (
        <div
          id={`ai-review-result-${checkinId}`}
          className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/90 space-y-1 animate-in fade-in duration-150"
        >
          <div className="flex items-start gap-2">
            <svg
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                aiReviewResult.flagged ? 'text-[#C26D55]' : 'text-[#3F7D5C]'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {aiReviewResult.flagged ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              )}
            </svg>
            <div className="text-xs space-y-0.5 flex-1">
              {aiReviewResult.flagged ? (
                <>
                  <p className="font-semibold text-neutral-900">
                    AI review note:{' '}
                    <span className="font-normal text-neutral-700">
                      {aiReviewResult.reason || 'The image appears very similar to a recent submission.'}
                    </span>
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    AI review is advisory. You make the final decision.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-neutral-800">
                    AI review found no obvious issue.
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    AI review is advisory. You make the final decision.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active prompt for "Ask for more" or "Flag" */}
      {activePrompt ? (
        <div
          id={`witness-prompt-box-${checkinId}`}
          className="p-3 rounded-lg border border-neutral-200 bg-neutral-50 space-y-2.5 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-800">
              {activePrompt === 'asked_for_more'
                ? 'Ask for more details (Optional note)'
                : 'Flag for follow-up (Optional note)'}
            </span>
            <span className="text-[10px] text-neutral-400 font-mono">
              {note.length}/500
            </span>
          </div>

          <textarea
            id={`input-witness-note-${checkinId}`}
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              activePrompt === 'asked_for_more'
                ? 'Add an encouraging question or clarification request...'
                : 'Briefly note what requires attention...'
            }
            disabled={submitting}
            className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 bg-white text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#3F7D5C]"
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              id={`btn-cancel-prompt-${checkinId}`}
              type="button"
              onClick={handleCancelPrompt}
              disabled={submitting}
              className="min-h-[44px] px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-800 rounded-lg hover:bg-neutral-200/60 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id={`btn-submit-prompt-${checkinId}`}
              type="button"
              onClick={handlePromptSubmit}
              disabled={submitting}
              className={`min-h-[44px] px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                activePrompt === 'flagged'
                  ? 'border border-[#C26D55] text-[#C26D55] bg-white hover:bg-[#C26D55]/10'
                  : 'bg-neutral-800 text-white hover:bg-neutral-900'
              }`}
            >
              {submitting ? (
                <div className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-neutral-800 rounded-full animate-spin"></div>
              ) : (
                <span>Submit Response</span>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Action buttons: minimum 44px tap target */
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Approve: Filled accent green */}
          <button
            id={`btn-witness-approve-${checkinId}`}
            type="button"
            onClick={handleApproveDirectly}
            disabled={submitting}
            className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-[#3F7D5C] hover:bg-[#34684c] disabled:opacity-50 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-none"
          >
            {submitting ? (
              <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>Approve</span>
              </>
            )}
          </button>

          {/* 2. Ask for more: Neutral outlined button */}
          <button
            id={`btn-witness-ask-${checkinId}`}
            type="button"
            onClick={() => {
              setActivePrompt('asked_for_more');
              setError(null);
            }}
            disabled={submitting}
            className="min-h-[44px] px-3.5 py-2 text-xs font-medium text-neutral-700 hover:text-neutral-900 border border-neutral-300 hover:bg-neutral-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Ask for more</span>
          </button>

          {/* 3. Flag: Muted terracotta outlined button (NEVER filled red) */}
          <button
            id={`btn-witness-flag-${checkinId}`}
            type="button"
            onClick={() => {
              setActivePrompt('flagged');
              setError(null);
            }}
            disabled={submitting}
            className="min-h-[44px] px-3.5 py-2 text-xs font-medium text-[#C26D55] border border-[#C26D55] hover:bg-[#C26D55]/5 disabled:opacity-50 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Flag</span>
          </button>
        </div>
      )}
    </div>
  );
}
