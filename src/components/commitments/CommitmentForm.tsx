import React, { useState } from 'react';
import { Commitment } from '../../types/index.ts';
import { useCommitments } from '../../hooks/useCommitments.ts';

interface CommitmentFormProps {
  initialCommitment?: Commitment;
  mode?: 'create' | 'edit';
  onSuccess?: (id?: string) => void;
  onCancel?: () => void;
}

export default function CommitmentForm({
  initialCommitment,
  mode = initialCommitment ? 'edit' : 'create',
  onSuccess,
  onCancel,
}: CommitmentFormProps) {
  const { createCommitment, updateCommitment } = useCommitments();

  // Helper to parse cadence into base selector and optional custom text
  const parseCadence = (cadenceStr?: string) => {
    if (!cadenceStr) return { base: 'daily', customText: '' };
    const lower = cadenceStr.toLowerCase().trim();
    if (lower === 'daily' || lower === 'weekly') {
      return { base: lower, customText: '' };
    }
    if (lower.startsWith('custom:')) {
      return { base: 'custom', customText: cadenceStr.slice(7).trim() };
    }
    if (lower === 'custom') {
      return { base: 'custom', customText: '' };
    }
    return { base: 'custom', customText: cadenceStr };
  };

  const parsedInitial = parseCadence(initialCommitment?.cadence);

  const [title, setTitle] = useState(initialCommitment?.title || '');
  const [cadenceType, setCadenceType] = useState<'daily' | 'weekly' | 'custom'>(
    parsedInitial.base as 'daily' | 'weekly' | 'custom'
  );
  const [customSchedule, setCustomSchedule] = useState(parsedInitial.customText || '');
  const [description, setDescription] = useState(initialCommitment?.description || '');

  const [titleError, setTitleError] = useState<string | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [descError, setDescError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    let isValid = true;
    setTitleError(null);
    setCustomError(null);
    setDescError(null);
    setSubmitError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError('Title is required and cannot be only whitespace.');
      isValid = false;
    } else if (trimmedTitle.length < 3) {
      setTitleError('Title must be at least 3 characters long.');
      isValid = false;
    } else if (trimmedTitle.length > 100) {
      setTitleError('Title cannot exceed 100 characters.');
      isValid = false;
    }

    if (cadenceType === 'custom') {
      const trimmedCustom = customSchedule.trim();
      if (!trimmedCustom) {
        setCustomError('Please describe your custom cadence (e.g. "3x per week").');
        isValid = false;
      } else if (trimmedCustom.length > 50) {
        setCustomError('Custom cadence description cannot exceed 50 characters.');
        isValid = false;
      }
    }

    if (description.trim().length > 500) {
      setDescError('Description cannot exceed 500 characters.');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const finalCadence =
      cadenceType === 'custom'
        ? `custom: ${customSchedule.trim()}`
        : cadenceType;

    try {
      if (mode === 'edit' && initialCommitment?.id) {
        await updateCommitment(initialCommitment.id, {
          title: title.trim(),
          cadence: finalCadence,
          description: description.trim(),
        });
        onSuccess?.(initialCommitment.id);
      } else {
        const newId = await createCommitment(
          title.trim(),
          finalCadence,
          description.trim()
        );
        onSuccess?.(newId);
      }
    } catch (err: any) {
      console.error('Commitment form submission error:', err);
      const isValidationError =
        typeof err?.message === 'string' &&
        !err.message.toLowerCase().includes('firebase') &&
        !err.message.toLowerCase().includes('firestore') &&
        !err.code;

      setSubmitError(
        isValidationError
          ? err.message
          : 'Could not save your commitment. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      id="form-commitment"
      onSubmit={handleSubmit}
      className="space-y-4 text-neutral-900"
      noValidate
    >
      {/* Title Field */}
      <div>
        <label
          htmlFor="commitment-title-input"
          className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1"
        >
          Commitment Title <span className="text-red-500">*</span>
        </label>
        <input
          id="commitment-title-input"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (titleError) setTitleError(null);
          }}
          disabled={submitting}
          placeholder="e.g. Daily meditation for 15 minutes"
          maxLength={105}
          className={`w-full px-3.5 py-2.5 rounded-lg border text-sm font-serif placeholder:font-sans transition-colors focus:outline-none focus:ring-2 focus:ring-[#3F7D5C] ${
            titleError
              ? 'border-red-500 bg-red-50/20'
              : 'border-neutral-200 bg-white focus:border-neutral-400'
          }`}
        />
        <div className="flex justify-between items-center mt-1">
          {titleError ? (
            <p id="error-commitment-title" className="text-xs text-red-600 font-medium">
              {titleError}
            </p>
          ) : (
            <span className="text-[11px] text-neutral-400">3 - 100 characters</span>
          )}
          <span className="text-[11px] text-neutral-400">{title.length}/100</span>
        </div>
      </div>

      {/* Cadence Selector */}
      <div>
        <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
          Cadence <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['daily', 'weekly', 'custom'] as const).map((type) => (
            <button
              key={type}
              id={`btn-cadence-${type}`}
              type="button"
              onClick={() => {
                setCadenceType(type);
                if (customError) setCustomError(null);
              }}
              disabled={submitting}
              className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all cursor-pointer capitalize text-center ${
                cadenceType === type
                  ? 'border-[#3F7D5C] bg-[#3F7D5C]/10 text-[#3F7D5C] font-semibold ring-1 ring-[#3F7D5C]'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Custom cadence schedule text field */}
        {cadenceType === 'custom' && (
          <div className="mt-2.5">
            <input
              id="commitment-custom-cadence-input"
              type="text"
              value={customSchedule}
              onChange={(e) => {
                setCustomSchedule(e.target.value);
                if (customError) setCustomError(null);
              }}
              disabled={submitting}
              placeholder="Describe schedule (e.g. 3x per week, every other day)"
              maxLength={50}
              className={`w-full px-3 py-2 rounded-lg border text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#3F7D5C] ${
                customError
                  ? 'border-red-500 bg-red-50/20'
                  : 'border-neutral-200 bg-white'
              }`}
            />
            {customError && (
              <p id="error-commitment-custom-cadence" className="text-xs text-red-600 mt-1 font-medium">
                {customError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Description Field */}
      <div>
        <label
          htmlFor="commitment-description-input"
          className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1"
        >
          Description / Intention <span className="text-neutral-400 font-normal lowercase">(optional)</span>
        </label>
        <textarea
          id="commitment-description-input"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (descError) setDescError(null);
          }}
          disabled={submitting}
          rows={3}
          placeholder="Why does this commitment matter to you? What does completion look like?"
          maxLength={510}
          className={`w-full px-3.5 py-2.5 rounded-lg border text-xs text-neutral-800 placeholder:text-neutral-400 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#3F7D5C] resize-none ${
            descError
              ? 'border-red-500 bg-red-50/20'
              : 'border-neutral-200 bg-white focus:border-neutral-400'
          }`}
        />
        <div className="flex justify-between items-center mt-1">
          {descError ? (
            <p id="error-commitment-description" className="text-xs text-red-600 font-medium">
              {descError}
            </p>
          ) : (
            <span className="text-[11px] text-neutral-400">Max 500 characters</span>
          )}
          <span className="text-[11px] text-neutral-400">{description.length}/500</span>
        </div>
      </div>

      {/* Submit Error banner */}
      {submitError && (
        <div id="error-commitment-submit" className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {submitError}
        </div>
      )}

      {/* Form Action Controls */}
      <div className="pt-2 flex items-center justify-end gap-2.5">
        {onCancel && (
          <button
            id="btn-commitment-cancel"
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          id="btn-commitment-submit"
          type="submit"
          disabled={submitting}
          className="px-5 py-2 text-xs font-semibold text-white bg-[#3F7D5C] hover:bg-[#34684c] rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
        >
          {submitting && (
            <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
          )}
          <span>
            {submitting
              ? mode === 'edit'
                ? 'Saving...'
                : 'Creating...'
              : mode === 'edit'
              ? 'Save Changes'
              : 'Create Commitment'}
          </span>
        </button>
      </div>
    </form>
  );
}
