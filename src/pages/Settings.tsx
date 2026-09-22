import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { useUserProfile } from '../hooks/useUserProfile.ts';
import { useResolvedAvatar } from '../hooks/useResolvedAvatar.ts';
import { useTheme } from '../hooks/useTheme.ts';
import type { NotificationPrefs } from '../types/index.ts';

export default function Settings() {
  const { signOut } = useAuth();
  const { profile, updateProfile } = useUserProfile();
  const avatarDisplayUrl = useResolvedAvatar(profile?.avatarUrl);
  const { theme, resolvedTheme, setTheme } = useTheme();

  const displayName = profile?.displayName || 'User';
  const email = profile?.email || '';
  const initial = (displayName.trim()[0] || 'U').toUpperCase();

  const prefs: NotificationPrefs = profile?.notificationPrefs ?? {
    checkinDue: true,
    witnessInvited: true,
    witnessResponded: true,
    challengeStarted: true,
  };

  const handleToggle = async (key: keyof NotificationPrefs) => {
    const updated: NotificationPrefs = {
      ...prefs,
      [key]: !prefs[key],
    };
    await updateProfile({ notificationPrefs: updated });
  };

  return (
    <div id="page-settings" className="px-4 py-6 max-w-[480px] mx-auto space-y-6">
      {/* Title */}
      <div className="pb-3 border-b border-neutral-200">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-neutral-900">Settings</h1>
        <p className="text-xs text-neutral-500 mt-0.5">Manage your identity, circles, and account preferences</p>
      </div>

      {/* 1. Account Section (Fully Functional) */}
      <section id="settings-section-account" className="bg-white border border-neutral-200 rounded-[12px] p-5 shadow-none">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div>
            <h2 className="font-serif text-sm font-semibold text-neutral-900">Account &amp; Identity</h2>
            <p className="text-xs text-neutral-500">Your profile information and credentials</p>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
            Active
          </span>
        </div>

        <div className="py-4 flex items-center justify-between gap-3 border-b border-neutral-100">
          <div className="flex items-center gap-3 min-w-0">
            {avatarDisplayUrl ? (
              <img
                src={avatarDisplayUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover border border-neutral-200 shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-neutral-900 text-white font-serif font-bold text-base flex items-center justify-center shrink-0 border border-neutral-200">
                {initial}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900 truncate">{displayName}</p>
              <p className="text-xs text-neutral-500 truncate font-mono">{email}</p>
            </div>
          </div>

          <Link
            id="link-settings-edit-profile"
            to="/profile"
            className="min-h-[36px] shrink-0 px-3.5 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center"
          >
            Edit Profile
          </Link>
        </div>

        <div className="pt-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-700">Account Session</p>
            <p className="text-[11px] text-neutral-400">Sign out of SANKALPA on this device</p>
          </div>
          <button
            id="btn-settings-signout"
            type="button"
            onClick={() => signOut()}
            className="min-h-[36px] px-3.5 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </section>

      {/* 2. Appearance Section */}
      <section id="settings-section-appearance" className="bg-white border border-neutral-200 rounded-[12px] p-5 shadow-none">
        <div className="pb-3 border-b border-neutral-100">
          <h2 className="font-serif text-sm font-semibold text-neutral-900">Appearance</h2>
          <p className="text-xs text-neutral-500">Choose how SANKALPA looks on this device</p>
        </div>

        <div className="pt-4 space-y-3">
          <p className="text-xs font-medium text-neutral-700">Theme Preference</p>
          <div className="grid grid-cols-3 gap-2">
            {(['system', 'light', 'dark'] as const).map((t) => {
              const active = theme === t;
              const labels = {
                system: 'System',
                light: 'Light',
                dark: 'Dark',
              };
              return (
                <button
                  key={t}
                  id={`btn-theme-${t}`}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`min-h-[44px] px-3 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    active
                      ? 'border-[#3F7D5C] bg-[#3F7D5C]/10 text-[#3F7D5C] font-semibold'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <span>{labels[t]}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-neutral-400">
            {theme === 'system'
              ? `Following system setting (currently ${resolvedTheme} mode)`
              : `Manual override active (${theme} mode)`}
          </p>
        </div>
      </section>

      {/* 2. Notifications Section */}
      <section id="settings-section-notifications" className="bg-white border border-neutral-200 rounded-[12px] p-5 shadow-none">
        <div className="pb-3 border-b border-neutral-100">
          <h2 className="font-serif text-sm font-semibold text-neutral-900">Notifications</h2>
          <p className="text-xs text-neutral-500">Configure which in-app reminders and activity updates you receive</p>
        </div>

        <div className="divide-y divide-neutral-100">
          {/* 1. Check-in reminders */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-neutral-800">Check-in reminders</p>
              <p className="text-[11px] text-neutral-400">Daily and cadence-based due check reminders for your commitments</p>
            </div>
            <button
              type="button"
              role="switch"
              id="toggle-checkinDue"
              aria-checked={prefs.checkinDue}
              onClick={() => handleToggle('checkinDue')}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                prefs.checkinDue ? 'bg-[#3F7D5C]' : 'bg-neutral-200'
              }`}
            >
              <span
                className={`block w-3.5 h-3.5 bg-white rounded-full transition-transform ${
                  prefs.checkinDue ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 2. Witness invitations */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-neutral-800">Witness invitations</p>
              <p className="text-[11px] text-neutral-400">Alerts when someone invites you to witness a commitment</p>
            </div>
            <button
              type="button"
              role="switch"
              id="toggle-witnessInvited"
              aria-checked={prefs.witnessInvited}
              onClick={() => handleToggle('witnessInvited')}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                prefs.witnessInvited ? 'bg-[#3F7D5C]' : 'bg-neutral-200'
              }`}
            >
              <span
                className={`block w-3.5 h-3.5 bg-white rounded-full transition-transform ${
                  prefs.witnessInvited ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 3. Witness responses */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-neutral-800">Witness responses</p>
              <p className="text-[11px] text-neutral-400">Updates when witnesses accept invitations or review your check-ins</p>
            </div>
            <button
              type="button"
              role="switch"
              id="toggle-witnessResponded"
              aria-checked={prefs.witnessResponded}
              onClick={() => handleToggle('witnessResponded')}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                prefs.witnessResponded ? 'bg-[#3F7D5C]' : 'bg-neutral-200'
              }`}
            >
              <span
                className={`block w-3.5 h-3.5 bg-white rounded-full transition-transform ${
                  prefs.witnessResponded ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 4. Circle challenge starts */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-neutral-800">Circle challenge starts</p>
              <p className="text-[11px] text-neutral-400">Notifications when a new group challenge begins in your circles</p>
            </div>
            <button
              type="button"
              role="switch"
              id="toggle-challengeStarted"
              aria-checked={prefs.challengeStarted}
              onClick={() => handleToggle('challengeStarted')}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                prefs.challengeStarted ? 'bg-[#3F7D5C]' : 'bg-neutral-200'
              }`}
            >
              <span
                className={`block w-3.5 h-3.5 bg-white rounded-full transition-transform ${
                  prefs.challengeStarted ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 3. Privacy & Witnessing Section */}
      <section id="settings-section-privacy" className="bg-white border border-neutral-200 rounded-[12px] p-5 shadow-none">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div>
            <h2 className="font-serif text-sm font-semibold text-neutral-900">Privacy &amp; Witnessing</h2>
            <p className="text-xs text-neutral-500">Default evidence visibility and circle discoverability</p>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-semibold bg-neutral-100 text-neutral-600 rounded-full border border-neutral-200">
            Coming soon
          </span>
        </div>
        <p className="pt-3 text-xs text-neutral-400 leading-relaxed">
          Granular controls for evidence sharing, anonymous witnessing, and circle invites will arrive soon.
        </p>
      </section>

      {/* 4. Data & Backups Section */}
      <section id="settings-section-data" className="bg-white border border-neutral-200 rounded-[12px] p-5 shadow-none">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div>
            <h2 className="font-serif text-sm font-semibold text-neutral-900">Data &amp; Export</h2>
            <p className="text-xs text-neutral-500">Commitment history archives and data portability</p>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-semibold bg-neutral-100 text-neutral-600 rounded-full border border-neutral-200">
            Coming soon
          </span>
        </div>
        <p className="pt-3 text-xs text-neutral-400 leading-relaxed">
          Tools to download your complete proof log and verify cryptographic integrity are in development.
        </p>
      </section>

      {/* 5. Philosophy & Public Landing */}
      <section id="settings-section-philosophy" className="bg-white border border-neutral-200 rounded-[12px] p-5 shadow-none">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-sm font-semibold text-neutral-900">The SANKALPA Ritual</h2>
            <p className="text-xs text-neutral-500">View the philosophy and landing experience</p>
          </div>
          <Link
            id="link-settings-landing"
            to="/landing"
            className="text-xs font-semibold text-[#3F7D5C] hover:underline flex items-center gap-1"
          >
            <span>Explore</span>
            <span>→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
