import { useState } from 'react';
import { Target, AlertCircle, Users, X } from 'lucide-react';
import { Circle, CircleMember } from '../../types/index.ts';
import { StartChallengeParams } from '../../hooks/useChallenges.ts';

interface StartChallengeModalProps {
  circle: Circle;
  members: CircleMember[];
  isOpen: boolean;
  onClose: () => void;
  onStart: (params: StartChallengeParams) => Promise<string>;
}

export default function StartChallengeModal({
  circle,
  members,
  isOpen,
  onClose,
  onStart,
}: StartChallengeModalProps) {
  const [title, setTitle] = useState('');
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'weekdays' | 'monthly' | 'custom'>('daily');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const acceptedMembers = members.filter((m) => m.status === 'accepted');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a challenge title');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onStart({
        circleId: circle.id || '',
        title: title.trim(),
        cadence,
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to start challenge');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="modal-start-challenge-backdrop"
      className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        id="modal-start-challenge"
        className="w-full max-w-[480px] sm:max-w-[440px] bg-white rounded-t-[20px] sm:rounded-2xl border border-neutral-200 shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto pb-safe animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
      >
        {/* Mobile drag handle indicator */}
        <div className="w-10 h-1 rounded-full bg-neutral-300 mx-auto mt-2.5 sm:hidden" />

        {/* Header */}
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-[#3F7D5C]/10 text-[#3F7D5C]">
              <Target className="w-4 h-4" />
            </span>
            <h3 className="font-serif text-base font-semibold text-neutral-900">
              Start Group Challenge
            </h3>
          </div>
          <button
            id="btn-close-challenge-modal"
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Info callout */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 flex items-start gap-2 text-xs text-neutral-600">
            <Users className="w-4 h-4 text-[#3F7D5C] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Starting a challenge atomically creates synchronized personal commitments for all{' '}
              <strong className="text-neutral-900">{acceptedMembers.length} accepted members</strong> of{' '}
              <strong className="text-neutral-900">{circle.name}</strong>.
            </p>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label
              htmlFor="input-challenge-title"
              className="block text-xs font-semibold text-neutral-700"
            >
              Challenge Title
            </label>
            <input
              id="input-challenge-title"
              type="text"
              required
              minLength={3}
              maxLength={100}
              placeholder="e.g., Morning Meditation Streak"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3F7D5C] focus:border-[#3F7D5C]"
            />
          </div>

          {/* Cadence */}
          <div className="space-y-1">
            <label
              htmlFor="select-challenge-cadence"
              className="block text-xs font-semibold text-neutral-700"
            >
              Target Cadence
            </label>
            <select
              id="select-challenge-cadence"
              value={cadence}
              onChange={(e) =>
                setCadence(e.target.value as 'daily' | 'weekly' | 'weekdays' | 'monthly' | 'custom')
              }
              className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3F7D5C] focus:border-[#3F7D5C]"
            >
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays (Mon–Fri)</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label
              htmlFor="input-challenge-desc"
              className="block text-xs font-semibold text-neutral-700"
            >
              Description (Optional)
            </label>
            <textarea
              id="input-challenge-desc"
              rows={2}
              maxLength={500}
              placeholder="What are the guidelines and intentions for this challenge?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3F7D5C] focus:border-[#3F7D5C]"
            />
          </div>

          {error && (
            <p id="challenge-modal-error" className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              id="btn-cancel-challenge"
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-3.5 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-submit-challenge"
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-[#3F7D5C] hover:bg-[#34684c] rounded-lg disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? 'Starting Challenge...' : 'Start Challenge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
