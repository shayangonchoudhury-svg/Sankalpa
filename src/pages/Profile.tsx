import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { useUserProfile } from '../hooks/useUserProfile.ts';
import { useTrustScore } from '../hooks/useTrustScore.ts';
import AvatarUpload from '../components/shared/AvatarUpload.tsx';

export default function Profile() {
  const { user } = useAuth();
  const { profile, loading, error: profileError, updateProfile } = useUserProfile();

  const [isEditing, setIsEditing] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const {
  score: trustScore,
  label: trustLabel,
  totalCheckins,
  approvedCount,
  flaggedCount,
  unrespondedCount,
  loading: trustLoading,
} = useTrustScore();

  // Sync form state when profile loads
  useEffect(() => {
    if (profile?.displayName) {
      setDisplayNameInput(profile.displayName);
    } else if (user?.displayName) {
      setDisplayNameInput(user.displayName);
    }
  }, [profile, user]);

  const validate = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) {
      return 'Display name is required.';
    }
    if (trimmed.length < 2) {
      return 'Display name must be at least 2 characters.';
    }
    if (trimmed.length > 40) {
      return 'Display name cannot exceed 40 characters.';
    }
    return null;
  };

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDisplayNameInput(val);
    if (validationError) {
      setValidationError(validate(val));
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const error = validate(displayNameInput);
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    setSaving(true);
    setSaveSuccessMessage(null);

    try {
      await updateProfile({
        displayName: displayNameInput.trim(),
      });
      setIsEditing(false);
      setSaveSuccessMessage('Display name updated successfully!');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Error saving profile in Profile.tsx:', err);
      setValidationError(err?.message || 'Something went wrong, please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDisplayNameInput(profile?.displayName || user?.displayName || 'User');
    setValidationError(null);
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div id="profile-loading" className="p-4 max-w-[480px] mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-neutral-200 rounded w-1/3 mb-6" />
        <div className="bg-white border border-neutral-200 rounded-[12px] p-6 flex flex-col items-center space-y-3">
          <div className="w-20 h-20 rounded-full bg-neutral-200" />
          <div className="h-3 bg-neutral-100 rounded w-1/2" />
        </div>
        <div className="bg-white border border-neutral-200 rounded-[12px] p-5 space-y-4">
          <div className="h-4 bg-neutral-200 rounded w-1/4" />
          <div className="h-8 bg-neutral-100 rounded" />
        </div>
      </div>
    );
  }

  const currentDisplayName = profile?.displayName || user?.displayName || 'User';
  const currentAvatarUrl = profile?.avatarUrl || user?.photoURL || undefined;
  const currentEmail = profile?.email || user?.email || 'No email attached';

  // Private self-reflection trust score (computed entirely client-side, never shared)

  return (
    <div id="page-profile" className="px-4 py-6 max-w-[480px] mx-auto">
      {/* Top Header / Breadcrumb */}
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <Link
            id="link-back-settings"
            to="/settings"
            className="p-1 -ml-1 text-neutral-500 hover:text-neutral-900 rounded-md transition-colors"
            aria-label="Back to Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-neutral-900">Your Identity</h1>
        </div>

        {!isEditing && (
          <button
            id="btn-edit-profile-toggle"
            type="button"
            onClick={() => setIsEditing(true)}
            className="min-h-[36px] px-3.5 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Edit Name
          </button>
        )}
      </div>

      {/* Global Profile Error */}
      {profileError && (
        <div id="profile-error-banner" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-[12px] text-xs text-red-700">
          {profileError}
        </div>
      )}

      {/* Success Notification */}
      {saveSuccessMessage && (
        <div id="profile-success-banner" className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-[12px] text-xs text-emerald-800 flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Avatar Section */}
      <div className="bg-white border border-neutral-200 rounded-[12px] p-6 shadow-none mb-6 text-center">
        <div className="flex justify-center mb-2">
          <AvatarUpload
            uid={user?.uid || ''}
            displayName={currentDisplayName}
            currentAvatarUrl={currentAvatarUrl}
            size="lg"
            onUploadSuccess={() => {
              setSaveSuccessMessage('Profile photo updated successfully!');
              setTimeout(() => setSaveSuccessMessage(null), 4000);
            }}
          />
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          Your avatar is visible to peers in your circles and witness requests.
        </p>
      </div>

      {/* Profile Details Form */}
      <div className="bg-white border border-neutral-200 rounded-[12px] p-5 shadow-none space-y-4">
        {isEditing ? (
          <form id="form-edit-profile" onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="input-display-name" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                id="input-display-name"
                type="text"
                required
                disabled={saving}
                value={displayNameInput}
                onChange={handleDisplayNameChange}
                placeholder="Your name or alias"
                maxLength={40}
                className={`w-full px-3.5 py-2 text-sm bg-white border rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all ${
                  validationError ? 'border-red-400 bg-red-50/20' : 'border-neutral-300'
                }`}
              />
              {validationError ? (
                <p id="error-display-name" className="mt-1.5 text-xs text-red-600 font-medium">
                  {validationError}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-neutral-400">Between 2 and 40 characters.</p>
              )}
            </div>

            {/* Read-only Email */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Email Address <span className="text-[11px] text-neutral-400 font-normal">(Read-only)</span>
              </label>
              <input
                type="email"
                disabled
                value={currentEmail}
                className="w-full px-3.5 py-2 text-sm bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-600 cursor-not-allowed"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                id="btn-save-profile"
                type="submit"
                disabled={saving}
                className="flex-1 py-2 px-4 bg-neutral-900 text-white rounded-lg text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                id="btn-cancel-profile"
                type="button"
                disabled={saving}
                onClick={handleCancel}
                className="py-2 px-4 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-semibold hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-neutral-100">
              <div>
                <span className="text-xs text-neutral-500 font-medium block">Display Name</span>
                <span id="text-display-name" className="text-sm font-semibold text-neutral-900">
                  {currentDisplayName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-xs font-semibold text-neutral-700 hover:text-neutral-900 underline underline-offset-2 transition-colors cursor-pointer"
              >
                Edit
              </button>
            </div>

            <div className="py-2 border-b border-neutral-100">
              <span className="text-xs text-neutral-500 font-medium block">Email Address</span>
              <span id="text-email" className="text-sm font-mono text-neutral-800">
                {currentEmail}
              </span>
            </div>

            <div className="py-2">
              <span className="text-xs text-neutral-500 font-medium block">Account UID</span>
              <span id="text-uid" className="text-xs font-mono text-neutral-400 break-all select-all">
                {user?.uid}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Private Self-Reflection Trust Metric (Authenticated User Only) */}
      <div
        id="section-trust-score"
        className="mt-6 bg-white rounded-[12px] border border-neutral-200 p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-sm font-semibold text-neutral-900">
              Private Trust Metric
            </h2>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Self-reflection on your personal commitment integrity
            </p>
          </div>
          <span
            id="trust-score-privacy-pill"
            className="inline-flex items-center gap-1 text-[10px] font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full"
          >
            <svg className="w-3 h-3 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Private
          </span>
        </div>

        {trustLoading ? (
          <div id="trust-score-loading" className="py-6 text-center">
            <div className="w-5 h-5 border-2 border-neutral-200 border-t-[#3F7D5C] rounded-full animate-spin mx-auto mb-2" />
            <p className="text-[11px] text-neutral-400 font-mono">Calculating metrics...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Score & Label display */}
            <div
              id="trust-score-main-display"
              className="p-4 rounded-xl bg-neutral-50/70 border border-neutral-100 flex items-center justify-between"
            >
              <div>
                <div className="text-[11px] text-neutral-400 font-mono uppercase tracking-wider">
                  Integrity Score
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span
                    id="trust-score-value"
                    className="font-serif text-2xl font-bold text-neutral-900"
                  >
                    {trustScore}
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">/ 100</span>
                </div>
              </div>

              <div className="text-right">
                <span
                  id="trust-score-label"
                  className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                    trustScore >= 70
                      ? 'bg-[#3F7D5C]/10 text-[#3F7D5C] border border-[#3F7D5C]/20'
                      : trustScore >= 40
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                  }`}
                >
                  {trustLabel}
                </span>
              </div>
            </div>

            {/* Inputs breakdown grid */}
            <div
              id="trust-score-inputs-grid"
              className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center"
            >
              <div
                id="stat-total-checkins"
                className="p-2.5 rounded-lg border border-neutral-100 bg-neutral-50/40"
              >
                <div className="text-[10px] text-neutral-400 font-mono uppercase">Submitted</div>
                <div className="text-sm font-semibold text-neutral-800 mt-0.5">
                  {totalCheckins}
                </div>
              </div>

              <div
                id="stat-approved-checkins"
                className="p-2.5 rounded-lg border border-neutral-100 bg-neutral-50/40"
              >
                <div className="text-[10px] text-neutral-400 font-mono uppercase">Witnessed</div>
                <div className="text-sm font-semibold text-[#3F7D5C] mt-0.5">
                  {approvedCount}
                </div>
              </div>

              <div
                id="stat-flagged-checkins"
                className="p-2.5 rounded-lg border border-neutral-100 bg-neutral-50/40"
              >
                <div className="text-[10px] text-neutral-400 font-mono uppercase">Flagged</div>
                <div className="text-sm font-semibold text-neutral-700 mt-0.5">
                  {flaggedCount}
                </div>
              </div>

              <div
                id="stat-unresponded-checkins"
                className="p-2.5 rounded-lg border border-neutral-100 bg-neutral-50/40"
              >
                <div className="text-[10px] text-neutral-400 font-mono uppercase">Awaiting</div>
                <div className="text-sm font-semibold text-neutral-500 mt-0.5">
                  {unrespondedCount}
                </div>
              </div>
            </div>

            {/* Methodology & Privacy Note */}
            <div className="space-y-1.5 pt-1 border-t border-neutral-100 text-[11px] text-neutral-500 leading-relaxed">
              <p id="trust-score-explanation">
                Derived deterministically from your witness approval rate (70%) and continuity across active commitments (30%).
              </p>
              <p id="trust-score-privacy-note" className="text-neutral-400 italic">
                Visible only to you on this device. SANKALPA never writes this score to Firestore or exposes it to witnesses.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
