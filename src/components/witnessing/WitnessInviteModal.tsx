import { useState } from 'react';
import { useWitnessInvites } from '../../hooks/useWitnessInvites.ts';

interface WitnessInviteModalProps {
  commitmentId: string;
  commitmentTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function WitnessInviteModal({
  commitmentId,
  commitmentTitle,
  isOpen,
  onClose,
}: WitnessInviteModalProps) {
  const { createInvite } = useWitnessInvites();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const targetEmail = email.trim();
    if (!targetEmail) {
      setError('Please enter an email address.');
      return;
    }

    setSubmitting(true);
    try {
      await createInvite(commitmentId, targetEmail);
      const normalized = targetEmail.toLowerCase();
      setSuccessMessage(`Invite sent to ${normalized}`);
      setEmail('');
      // Auto-close after brief confirmation
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Invite submission error:', err);
      setError(err?.message || 'Failed to send invitation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setError(null);
    setSuccessMessage(null);
    onClose();
  };

  return (
    <div
      id="modal-witness-invite"
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-[480px] sm:max-w-md bg-white rounded-t-[20px] sm:rounded-[16px] border border-neutral-200 p-5 sm:p-6 space-y-4 sm:space-y-5 shadow-xl max-h-[90vh] overflow-y-auto pb-safe animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle indicator */}
        <div className="w-10 h-1 rounded-full bg-neutral-300 mx-auto -mt-1 mb-2 sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-serif text-lg font-bold text-neutral-900">
              Invite a Witness
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
              For: <span className="font-medium text-neutral-800">{commitmentTitle}</span>
            </p>
          </div>
          <button
            id="btn-close-invite-modal"
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Informative text */}
        <p className="text-xs text-neutral-600 leading-relaxed">
          Invite someone you trust to witness your practice. Once accepted, they can review your check-ins and offer silent accountability.
        </p>

        {/* Error Alert */}
        {error && (
          <div
            id="invite-modal-error"
            className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700 leading-relaxed"
          >
            {error}
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div
            id="invite-modal-success"
            className="p-3 rounded-lg border border-[#3F7D5C]/30 bg-[#3F7D5C]/10 text-xs text-[#3F7D5C] font-medium leading-relaxed"
          >
            {successMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="input-witness-email"
              className="block text-xs font-medium text-neutral-700"
            >
              Witness Email Address
            </label>
            <input
              id="input-witness-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. friend@example.com"
              disabled={submitting || Boolean(successMessage)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-300 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#3F7D5C] focus:border-transparent transition-all"
            />
            <p className="text-[11px] text-neutral-400 leading-normal">
              The invitation will appear in their SANKALPA Witness Inbox when they sign in with this email.
            </p>
          </div>

          {/* Buttons with minimum 44px touch targets */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              id="btn-cancel-invite"
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="min-h-[44px] px-4 py-2 text-xs font-medium text-neutral-700 hover:text-neutral-900 border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-submit-invite"
              type="submit"
              disabled={submitting || !email.trim() || Boolean(successMessage)}
              className="min-h-[44px] px-5 py-2 text-xs font-semibold text-white bg-[#3F7D5C] hover:bg-[#34684c] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-none"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                  <span>Sending invite...</span>
                </>
              ) : (
                <span>Send Invitation</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
