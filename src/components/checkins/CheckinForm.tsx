import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase.ts';
import { getReflectivePrompt } from '../../services/aiService.ts';
import {
  MAX_NOTE_LENGTH,
  MAX_IMAGE_INPUT_BYTES,
  MAX_VIDEO_BYTES,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
} from '../../hooks/useCheckins.ts';

interface CheckinFormProps {
  commitmentId: string;
  commitmentOwnerId: string;
  commitmentTitle?: string;
  commitmentCadence?: string;
  onSubmit: (note?: string, evidenceFile?: File | null) => Promise<string>;
  onSuccess?: (checkinId: string) => void;
  onCancel?: () => void;
}

export default function CheckinForm({
  commitmentId,
  commitmentOwnerId,
  commitmentTitle,
  commitmentCadence,
  onSubmit,
  onSuccess,
  onCancel,
}: CheckinFormProps) {
  const [note, setNote] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reflective AI Prompt State
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Request ONE reflective question on form opening (non-blocking, fails gracefully)
  useEffect(() => {
    let isMounted = true;

    async function loadPrompt() {
      try {
        let title = commitmentTitle;
        let cadence = commitmentCadence || 'daily';

        if (!title && commitmentId) {
          const snap = await getDoc(doc(db, 'commitments', commitmentId));
          if (snap.exists()) {
            const data = snap.data();
            title = data.title;
            cadence = data.cadence || 'daily';
          }
        }

        if (title && isMounted) {
          const question = await getReflectivePrompt(title, cadence);
          if (isMounted && question) {
            setAiPrompt(question);
          }
        }
      } catch (err) {
        // AI is strictly optional. Graceful silence on failure.
        console.debug('AI prompt load skipped/failed:', err);
      }
    }

    loadPrompt();

    return () => {
      isMounted = false;
    };
  }, [commitmentId]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setSubmitError(null);

    const files = e.target.files;
    // If the user cancelled the file picker, keep current state without crashing or errors
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    const fileType = file.type || '';
    const isImage = ALLOWED_IMAGE_TYPES.includes(fileType);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(fileType);

    if (!isImage && !isVideo) {
      setFileError('Supported formats: JPG, PNG, WebP images, or MP4 video.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (isImage && file.size > MAX_IMAGE_INPUT_BYTES) {
      setFileError('Image must be smaller than 5MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      setFileError('Video must be smaller than 20MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);

    // Create instant local thumbnail preview for images
    if (isImage) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleRemoveFile = () => {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setFileError(null);

    const trimmedNote = note.trim();

    // Minimum-content rule: at least non-empty note OR evidence file required
    if (!trimmedNote && !selectedFile) {
      setSubmitError('Please enter a note or attach photo/video evidence.');
      return;
    }

    if (trimmedNote.length > MAX_NOTE_LENGTH) {
      setSubmitError(`Note cannot exceed ${MAX_NOTE_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    setStatusMessage(selectedFile ? 'Uploading evidence...' : 'Recording check-in...');

    try {
      const checkinId = await onSubmit(trimmedNote, selectedFile);
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
      setNote('');
      setSelectedFile(null);
      setFilePreviewUrl(null);
      if (onSuccess) {
        onSuccess(checkinId);
      }
    } catch (err: any) {
      console.error('Checkin submission failure:', err);
      // Preserve user input and display honest real error
      setSubmitError(err?.message || 'Failed to submit check-in. Please try again.');
    } finally {
      setSubmitting(false);
      setStatusMessage(null);
    }
  };

  const isVideo = selectedFile && ALLOWED_VIDEO_TYPES.includes(selectedFile.type);
  const formattedFileSize = selectedFile
    ? (selectedFile.size / (1024 * 1024)).toFixed(1) + ' MB'
    : '';

  return (
    <form
      id="form-checkin"
      onSubmit={handleSubmit}
      className="p-5 rounded-[12px] border border-neutral-200 bg-white space-y-4 shadow-none"
    >
      <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
        <div>
          <h3 className="font-serif text-base font-semibold text-neutral-900">
            Check In
          </h3>
          <p className="text-xs text-neutral-500">
            Record your practice with an optional note or evidence.
          </p>
        </div>
        {onCancel && (
          <button
            id="btn-cancel-checkin-top"
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="text-neutral-400 hover:text-neutral-600 p-1 rounded transition-colors disabled:opacity-50"
            aria-label="Cancel check-in"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Honest Error Banner */}
      {submitError && (
        <div
          id="checkin-submit-error"
          className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg leading-relaxed flex items-start gap-2"
        >
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{submitError}</span>
        </div>
      )}

      {/* Reflective AI Prompt (Optional, Non-blocking, Calm SANKALPA styling) */}
      {aiPrompt && (
        <div
          id="ai-reflective-prompt-box"
          className="p-3 bg-neutral-50 border border-neutral-200/80 rounded-lg space-y-1 animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
            <span className="text-[#3F7D5C] font-semibold">✦</span>
            <span>AI suggested</span>
          </div>
          <p
            id="ai-reflective-prompt-text"
            className="text-xs text-neutral-800 leading-relaxed font-serif italic"
          >
            "{aiPrompt}"
          </p>
        </div>
      )}

      {/* Note Input */}
      <div className="space-y-1">
        <label
          htmlFor="checkin-note-input"
          className="block text-xs font-semibold text-neutral-700"
        >
          Note <span className="font-normal text-neutral-400">(optional with evidence)</span>
        </label>
        <textarea
          id="checkin-note-input"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={submitting}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="Reflect on your practice, record thoughts, or describe your progress..."
          className="w-full text-xs text-neutral-800 placeholder:text-neutral-400 border border-neutral-200 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-[#3F7D5C] focus:border-[#3F7D5C] transition-colors resize-none disabled:bg-neutral-50"
        />
        <div className="flex justify-end">
          <span
            id="checkin-char-counter"
            className={`text-[11px] font-mono ${
              note.length > MAX_NOTE_LENGTH * 0.9 ? 'text-amber-600' : 'text-neutral-400'
            }`}
          >
            {note.length}/{MAX_NOTE_LENGTH}
          </span>
        </div>
      </div>

      {/* Evidence File Picker */}
      <div className="space-y-2">
        <span className="block text-xs font-semibold text-neutral-700">
          Evidence <span className="font-normal text-neutral-400">(optional photo or MP4 video)</span>
        </span>

        <input
          id="checkin-file-input"
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4"
          onChange={handleFileChange}
          disabled={submitting}
          className="hidden"
        />

        {!selectedFile ? (
          <div>
            <button
              id="btn-select-evidence"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Attach photo or video</span>
            </button>
            <p className="text-[11px] text-neutral-400 mt-1">
              JPG, PNG, WebP up to 5MB · MP4 video up to 20MB
            </p>
          </div>
        ) : (
          /* Selected File Preview Box */
          <div
            id="checkin-selected-file-preview"
            className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 bg-neutral-50/70 text-xs"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              {filePreviewUrl ? (
                <img
                  src={filePreviewUrl}
                  alt="Evidence preview"
                  className="w-10 h-10 object-cover rounded border border-neutral-200 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded bg-neutral-200 text-neutral-600 flex items-center justify-center shrink-0">
                  {isVideo ? (
                    <svg className="w-5 h-5 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
              )}
              <div className="truncate">
                <p className="font-medium text-neutral-800 truncate max-w-[200px]">
                  {selectedFile.name}
                </p>
                <p className="text-[11px] text-neutral-500">
                  {isVideo ? 'Video (MP4)' : 'Photo'} · {formattedFileSize}
                </p>
              </div>
            </div>

            <button
              id="btn-remove-evidence"
              type="button"
              onClick={handleRemoveFile}
              disabled={submitting}
              className="text-neutral-400 hover:text-red-600 p-1.5 rounded transition-colors cursor-pointer disabled:opacity-50"
              aria-label="Remove attached evidence"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {fileError && (
          <p id="checkin-file-error" className="text-xs text-red-600">
            {fileError}
          </p>
        )}
      </div>

      {/* Submission Actions */}
      <div className="pt-2 flex items-center justify-end gap-2.5">
        {onCancel && (
          <button
            id="btn-cancel-checkin"
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-3.5 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
        )}

        <button
          id="btn-submit-checkin"
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#3F7D5C] hover:bg-[#34684c] rounded-lg transition-colors cursor-pointer shadow-none disabled:opacity-50 flex items-center gap-1.5"
        >
          {submitting && (
            <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
          )}
          <span>{statusMessage || 'Submit Check-in'}</span>
        </button>
      </div>
    </form>
  );
}
