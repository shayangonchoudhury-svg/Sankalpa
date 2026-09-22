import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { useTheme } from '../hooks/useTheme.ts';
import { RitualOrbital } from '../components/shared/RitualOrbital.tsx';
import { EditorialDivider } from '../components/shared/EditorialDivider.tsx';
import {
  Shield,
  ArrowRight,
  Sun,
  Moon,
  Check,
  Clock,
  Eye,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export default function Landing() {
  const { user } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();

  // Interactive Demonstration State (purely client-side, zero Firestore, zero persistence)
  const [demoState, setDemoState] = useState<'not_started' | 'showing_up' | 'kept'>('showing_up');

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const toggleThemeMode = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  return (
    <div id="page-landing" className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors">
      {/* Editorial Top Navigation */}
      <header
        id="landing-nav"
        className="sticky top-0 z-40 bg-[var(--bg-viewport)]/90 backdrop-blur-md border-b border-[var(--border-default)] px-4 sm:px-8 py-3.5 transition-colors"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/landing"
              id="landing-brand"
              className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] hover:opacity-85 transition-opacity"
            >
              SANKALPA
            </Link>
            <span className="hidden sm:inline-block text-[11px] font-mono text-[var(--text-muted)] pl-2 border-l border-[var(--border-default)]">
              A modern ritual for keeping your word.
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <nav className="hidden md:flex items-center gap-5 text-xs text-[var(--text-secondary)] font-medium">
              <button
                type="button"
                onClick={() => scrollToSection('philosophy')}
                className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                Philosophy
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('how-it-works')}
                className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                How it Works
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('witnessing')}
                className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                Witnessing
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('preview')}
                className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                Product
              </button>
            </nav>

            {/* Theme switch button */}
            <button
              id="landing-theme-toggle"
              type="button"
              onClick={toggleThemeMode}
              aria-label="Toggle visual theme"
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--border-subtle)] transition-colors cursor-pointer"
            >
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Primary navigation action */}
            {user ? (
              <Link
                id="landing-btn-dashboard"
                to="/home"
                className="min-h-[44px] px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-viewport)] rounded-lg text-xs font-semibold hover:opacity-90 active:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Enter SANKALPA</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <Link
                id="landing-btn-signin"
                to="/login"
                className="min-h-[44px] px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-viewport)] rounded-lg text-xs font-semibold hover:opacity-90 active:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-10 sm:py-16 space-y-20 sm:space-y-32">
        {/* ========================================================================= */}
        {/* 1. HERO SECTION                                                          */}
        {/* ========================================================================= */}
        <section id="hero" className="hero-entrance relative pt-4 sm:pt-10 pb-8 sm:pb-16 text-center max-w-4xl mx-auto">
          {/* Background fine-line orbital geometry */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 text-[var(--text-primary)] opacity-40">
            <RitualOrbital size="hero" showNodes={true} />
          </div>

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-viewport)] text-[10px] sm:text-xs font-mono tracking-widest uppercase text-[var(--text-muted)] mb-6 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-sage)]" />
            <span>THE PRACTICE OF KEEPING YOUR WORD</span>
          </div>

          {/* Large Fraunces headline */}
          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-[var(--text-primary)] leading-[1.08] mb-6">
            Make a promise.
            <br />
            <span className="italic font-normal text-[var(--accent-sage)]">Keep it.</span>
          </h1>

          {/* Supporting editorial copy */}
          <p className="text-base sm:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto font-normal leading-relaxed mb-8 sm:mb-10">
            SANKALPA turns intentions into commitments, commitments into practice, and practice into trust.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
            <Link
              id="hero-cta-primary"
              to={user ? '/home' : '/login'}
              className="w-full sm:w-auto min-h-[44px] px-7 py-3 bg-[var(--text-primary)] text-[var(--bg-viewport)] rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <span>{user ? 'Go to Home' : 'Begin your practice'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              id="hero-cta-secondary"
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="w-full sm:w-auto min-h-[44px] px-6 py-3 bg-[var(--bg-viewport)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-xl text-sm font-medium hover:bg-[var(--border-subtle)] active:scale-[0.99] transition-all cursor-pointer shadow-xs"
            >
              Explore SANKALPA
            </button>
          </div>

          {/* ========================================================================= */}
          {/* HERO VISUAL: Floating Journal Card with Connected Orbital Elements        */}
          {/* ========================================================================= */}
          <div className="mt-14 sm:mt-20 relative max-w-md mx-auto">
            {/* Subtle orbital lines around central card */}
            <div className="absolute inset-0 -m-8 sm:-m-12 flex items-center justify-center -z-10 text-[var(--text-muted)]">
              <RitualOrbital size="lg" showNodes={true} />
            </div>

            {/* Central Floating Journal Commitment Card */}
            <div
              id="hero-visual-card"
              className="bg-[var(--bg-viewport)] border border-[var(--border-default)] rounded-2xl p-6 sm:p-7 text-left shadow-md transition-all hover:border-[var(--border-strong)]"
            >
              {/* Journal Card Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-4">
                <span className="font-serif text-xs font-semibold tracking-widest text-[var(--text-muted)] uppercase">
                  SANKALPA
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-[var(--accent-sage-subtle)] text-[var(--accent-sage)] font-medium">
                  Daily practice
                </span>
              </div>

              {/* Title & Intention */}
              <h2 className="font-serif text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">
                Read 20 pages
              </h2>
              <p className="text-xs text-[var(--text-muted)] mb-5">
                Every evening before sleep · 20 minutes of undistracted focus.
              </p>

              {/* Cadence Visual Rhythm Dots (6 active, 1 open) */}
              <div className="flex items-center gap-2 mb-5">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-sage)] ring-2 ring-[var(--accent-sage)]/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-sage)] ring-2 ring-[var(--accent-sage)]/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-sage)] ring-2 ring-[var(--accent-sage)]/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-sage)] ring-2 ring-[var(--accent-sage)]/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-sage)] ring-2 ring-[var(--accent-sage)]/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-sage)] ring-2 ring-[var(--accent-sage)]/20" />
                <span className="w-2.5 h-2.5 rounded-full border border-[var(--border-strong)] bg-transparent" />
              </div>

              {/* Streak and Reflection */}
              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <span className="font-serif text-sm font-semibold text-[var(--text-primary)]">
                    6 day streak
                  </span>
                  <p className="text-[11px] text-[var(--text-muted)] italic font-serif mt-0.5">
                    "Keep showing up."
                  </p>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--text-secondary)]">
                  <Eye className="w-3 h-3 text-[var(--accent-sage)]" />
                  <span>Witnessed</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* HERO INTERACTIVE ELEMENT: Safe Demonstration Toggle (NO FIRESTORE DATA)    */}
        {/* ========================================================================= */}
        <section className="max-w-xl mx-auto bg-[var(--bg-viewport)] border border-[var(--border-default)] rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="text-center mb-6">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-1">
              TRY THE RHYTHM
            </span>
            <h2 className="font-serif text-lg sm:text-xl font-bold text-[var(--text-primary)]">
              How a commitment feels in practice
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
              Toggle the stages below to see how a daily promise transforms from an intention into verified trust.
            </p>
          </div>

          {/* Interactive Toggle Control */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[var(--bg-surface-subtle)] rounded-xl border border-[var(--border-subtle)] mb-6">
            <button
              id="demo-toggle-not-started"
              type="button"
              onClick={() => setDemoState('not_started')}
              className={`min-h-[44px] py-2 px-3 text-xs font-medium rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center ${
                demoState === 'not_started'
                  ? 'bg-[var(--bg-viewport)] text-[var(--text-primary)] font-semibold shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Not started</span>
              </span>
            </button>

            <button
              id="demo-toggle-showing-up"
              type="button"
              onClick={() => setDemoState('showing_up')}
              className={`min-h-[44px] py-2 px-3 text-xs font-medium rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center ${
                demoState === 'showing_up'
                  ? 'bg-[var(--bg-viewport)] text-[var(--text-primary)] font-semibold shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[var(--accent-amber)]" />
                <span>Showing up</span>
              </span>
            </button>

            <button
              id="demo-toggle-kept"
              type="button"
              onClick={() => setDemoState('kept')}
              className={`min-h-[44px] py-2 px-3 text-xs font-medium rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center ${
                demoState === 'kept'
                  ? 'bg-[var(--bg-viewport)] text-[var(--text-primary)] font-semibold shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="flex items-center gap-1">
                <Check className="w-3 h-3 text-[var(--accent-sage)]" />
                <span>Kept</span>
              </span>
            </button>
          </div>

          {/* Interactive Demonstration Preview Box */}
          <div className="border border-[var(--border-default)] rounded-xl p-4 sm:p-5 bg-[var(--bg-surface-subtle)] space-y-3 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">TODAY'S PROMISE</span>
                <p className="font-serif text-base font-bold text-[var(--text-primary)]">
                  Morning Meditation (20 min)
                </p>
              </div>

              {/* Status Badge */}
              {demoState === 'not_started' && (
                <span className="px-2.5 py-1 text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-full border border-neutral-200 dark:border-neutral-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                  Due today
                </span>
              )}
              {demoState === 'showing_up' && (
                <span className="px-2.5 py-1 text-[11px] font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-full border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Awaiting witness
                </span>
              )}
              {demoState === 'kept' && (
                <span className="px-2.5 py-1 text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Approved by Witness
                </span>
              )}
            </div>

            {/* Dynamic Stage Commentary */}
            <div className="pt-2 text-xs text-[var(--text-secondary)] leading-relaxed">
              {demoState === 'not_started' && (
                <p>
                  The intention is set for the day. No reflection has been written yet. Your streak remains in grace until nightfall.
                </p>
              )}
              {demoState === 'showing_up' && (
                <div className="p-3 bg-[var(--bg-viewport)] rounded-lg border border-[var(--border-subtle)] space-y-1.5">
                  <p className="font-serif italic text-[var(--text-primary)]">
                    "Sat on the mat before sunrise. Breath was calmer today. 20 minutes completed."
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono">
                    Reflected at 06:42 AM · Sent to witness Elena for verification.
                  </p>
                </div>
              )}
              {demoState === 'kept' && (
                <div className="p-3 bg-[var(--bg-viewport)] rounded-lg border border-[var(--border-subtle)] flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      Streak extended to 14 days
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Witnessed by Elena K. · Trust Score updated to 98%
                    </p>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[var(--accent-sage-subtle)] text-[var(--accent-sage)] flex items-center justify-center font-bold text-xs">
                    ✓
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="text-[10px] font-mono text-[var(--text-muted)] text-center mt-3">
            * Interactive demonstration only — no real account or data is created.
          </p>
        </section>

        {/* ========================================================================= */}
        {/* 2. HERO SECONDARY SECTION: "A commitment is more than a checkbox"        */}
        {/* ========================================================================= */}
        <section id="principles" className="space-y-8">
          <EditorialDivider number="01" label="THE THREE PILLARS" />

          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
              A commitment is more than a checkbox.
            </h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Most tools treat habits like mechanical chores. SANKALPA approaches your promises as covenants of personal dignity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            {/* Card 1: Intention */}
            <div className="bg-[var(--bg-viewport)] border border-[var(--border-default)] rounded-2xl p-6 sm:p-7 space-y-4 hover:border-[var(--border-strong)] transition-all">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-sage)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
                  <circle cx="12" cy="12" r="3" fill="currentColor" />
                </svg>
              </div>
              <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">
                INTENTION
              </h3>
              <p className="text-xs font-semibold text-[var(--accent-sage)] font-mono uppercase tracking-wider">
                Decide what matters.
              </p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Choose few, deliberate practices. A sankalpa begins with the clarity of what you are truly willing to protect.
              </p>
            </div>

            {/* Card 2: Practice */}
            <div className="bg-[var(--bg-viewport)] border border-[var(--border-default)] rounded-2xl p-6 sm:p-7 space-y-4 hover:border-[var(--border-strong)] transition-all">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-amber)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 12h16M12 4v16" strokeDasharray="2 4" />
                  <circle cx="12" cy="12" r="8" />
                </svg>
              </div>
              <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">
                PRACTICE
              </h3>
              <p className="text-xs font-semibold text-[var(--accent-amber)] font-mono uppercase tracking-wider">
                Return to it consistently.
              </p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Rhythm matters more than intensity. Each check-in is an opportunity to reflect on resistance and stay true.
              </p>
            </div>

            {/* Card 3: Trust */}
            <div className="bg-[var(--bg-viewport)] border border-[var(--border-default)] rounded-2xl p-6 sm:p-7 space-y-4 hover:border-[var(--border-strong)] transition-all">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-clay)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="12" r="4" />
                  <circle cx="16" cy="12" r="4" />
                  <path d="M12 8v8" strokeDasharray="1 2" />
                </svg>
              </div>
              <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">
                TRUST
              </h3>
              <p className="text-xs font-semibold text-[var(--accent-clay)] font-mono uppercase tracking-wider">
                Let consistency become visible.
              </p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                When a witness verifies your word, accountability becomes external, quiet, and deeply honorable.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. HOW SANKALPA WORKS (4-Step Timeline)                                  */}
        {/* ========================================================================= */}
        <section id="how-it-works" className="space-y-10">
          <EditorialDivider number="02" label="HOW IT WORKS" />

          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
              The four stages of accountability
            </h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Designed as an unbroken ritual from initial declaration to verified integrity.
            </p>
          </div>

          {/* Desktop: Horizontal Timeline / Mobile: Vertical Editorial Timeline */}
          <div className="relative">
            {/* Desktop connecting rule */}
            <div className="hidden md:block absolute top-7 left-12 right-12 h-px bg-[var(--border-default)] -z-0" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6 relative z-10">
              {/* Step 1 */}
              <div className="relative pl-8 md:pl-0 flex flex-col">
                <div className="absolute left-0 top-0 md:static flex items-center justify-center w-8 h-8 rounded-full bg-[var(--bg-viewport)] border-2 border-[var(--text-primary)] text-xs font-mono font-bold text-[var(--text-primary)] md:mb-4">
                  01
                </div>
                <h3 className="font-serif text-lg font-bold text-[var(--text-primary)] mb-1.5">
                  Make a commitment
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Declare your promise with a title, description, and strict cadence: daily, weekdays, weekly, or monthly.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative pl-8 md:pl-0 flex flex-col">
                <div className="absolute left-0 top-0 md:static flex items-center justify-center w-8 h-8 rounded-full bg-[var(--bg-viewport)] border-2 border-[var(--accent-amber)] text-xs font-mono font-bold text-[var(--accent-amber)] md:mb-4">
                  02
                </div>
                <h3 className="font-serif text-lg font-bold text-[var(--text-primary)] mb-1.5">
                  Show up
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Log your honest reflection on schedule. Optionally attach photo evidence to capture the physical reality of the work.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative pl-8 md:pl-0 flex flex-col">
                <div className="absolute left-0 top-0 md:static flex items-center justify-center w-8 h-8 rounded-full bg-[var(--bg-viewport)] border-2 border-[var(--accent-sage)] text-xs font-mono font-bold text-[var(--accent-sage)] md:mb-4">
                  03
                </div>
                <h3 className="font-serif text-lg font-bold text-[var(--text-primary)] mb-1.5">
                  Be witnessed
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Invite trusted peers to review your check-in. They review and confirm you followed through.
                </p>
              </div>

              {/* Step 4 */}
              <div className="relative pl-8 md:pl-0 flex flex-col">
                <div className="absolute left-0 top-0 md:static flex items-center justify-center w-8 h-8 rounded-full bg-[var(--bg-viewport)] border-2 border-[var(--accent-clay)] text-xs font-mono font-bold text-[var(--accent-clay)] md:mb-4">
                  04
                </div>
                <h3 className="font-serif text-lg font-bold text-[var(--text-primary)] mb-1.5">
                  Build trust
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Streaks accumulate mathematically. Your Trust Score deepens over time as an undeniable record of reliability.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. PHILOSOPHY SECTION (Large Fraunces Editorial Statement)                */}
        {/* ========================================================================= */}
        <section id="philosophy" className="py-12 sm:py-20 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 opacity-30 text-[var(--text-primary)]">
            <RitualOrbital size="hero" showNodes={false} />
          </div>

          <EditorialDivider number="03" label="PHILOSOPHY" />

          <div className="max-w-3xl mx-auto space-y-6 pt-6">
            <blockquote className="font-serif text-3xl sm:text-5xl md:text-6xl font-normal tracking-tight text-[var(--text-primary)] leading-[1.15]">
              “Consistency is quieter than motivation.”
            </blockquote>

            <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed pt-2">
              Motivation arrives in bursts; it is loud, fleeting, and easily exhausted. A sankalpa is quiet, steady, and binding. When you commit to a practice and invite another human being to witness it, you shift accountability from private guilt to shared clarity.
            </p>

            <div className="pt-4 flex items-center justify-center gap-2 text-xs font-mono text-[var(--text-muted)]">
              <span>SANKALPA (सङ्कल्प)</span>
              <span>·</span>
              <span>An intention formed in the heart and upheld by the will</span>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. TRUST / WITNESS SECTION: Connected Cards Diagram                      */}
        {/* ========================================================================= */}
        <section id="witnessing" className="space-y-8">
          <EditorialDivider number="04" label="THE WITNESS RELATIONSHIP" />

          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
              You don't have to keep every promise alone.
            </h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Accountability works best when it is personal, dignified, and free from vanity metrics.
            </p>
          </div>

          {/* Connected Cards: YOU -> COMMITMENT -> WITNESS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center max-w-3xl mx-auto pt-6">
            {/* You */}
            <div className="bg-[var(--bg-viewport)] border border-[var(--border-default)] rounded-xl p-5 text-center space-y-2 shadow-xs">
              <div className="w-10 h-10 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] mx-auto flex items-center justify-center font-serif font-bold text-sm text-[var(--text-primary)]">
                YOU
              </div>
              <p className="font-serif text-sm font-bold text-[var(--text-primary)]">The Promise Maker</p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Sets the boundary. Shows up without excuses. Logs honest reflection.
              </p>
            </div>

            {/* Connecting Arrow / Line (Desktop: Right arrow, Mobile: Down arrow) */}
            <div className="hidden md:flex flex-col items-center justify-center text-[var(--accent-sage)]">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-1">
                BOUND BY
              </span>
              <div className="w-full flex items-center">
                <div className="h-px bg-[var(--border-default)] flex-1" />
                <ArrowRight className="w-4 h-4 text-[var(--accent-sage)] mx-1 shrink-0" />
                <div className="h-px bg-[var(--border-default)] flex-1" />
              </div>
            </div>

            {/* Witness */}
            <div className="bg-[var(--bg-viewport)] border border-[var(--border-default)] rounded-xl p-5 text-center space-y-2 shadow-xs">
              <div className="w-10 h-10 rounded-full bg-[var(--accent-sage-subtle)] border border-[var(--accent-sage)]/30 mx-auto flex items-center justify-center font-serif font-bold text-sm text-[var(--accent-sage)]">
                <Eye className="w-4 h-4" />
              </div>
              <p className="font-serif text-sm font-bold text-[var(--text-primary)]">The Witness</p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                A chosen companion. Verifies completion. Honors your word with a single review.
              </p>
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              No public feeds. No algorithmic judgment. Just one-to-one integrity between people who believe in each other.
            </p>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 6. PRODUCT PREVIEW: True SANKALPA Application Aesthetic                  */}
        {/* ========================================================================= */}
        <section id="preview" className="space-y-8">
          <EditorialDivider number="05" label="PRODUCT AESTHETIC" />

          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
              Crafted for quiet focus
            </h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Every detail is designed to calm your attention and clarify what matters.
            </p>
          </div>

          {/* 4 Preview Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
            {/* Tile 1: Commitments */}
            <div className="bg-[var(--bg-viewport)] border border-[var(--border-default)] rounded-xl p-5 space-y-3 shadow-xs">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">
                01 · COMMITMENTS
              </span>
              <p className="font-serif text-base font-bold text-[var(--text-primary)]">
                Dawn Meditation
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--accent-sage)]" />
                <span className="text-xs font-medium text-[var(--accent-sage)]">18-day streak</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Cadence: Daily · Witness: Marcus R.
              </p>
            </div>

            {/* Tile 2: Check-ins */}
            <div className="bg-[var(--bg-viewport)] border border-[var(--border-default)] rounded-xl p-5 space-y-3 shadow-xs">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">
                02 · REFLECTION
              </span>
              <p className="font-serif text-xs italic text-[var(--text-primary)]">
                "Writing before dawn. 1,000 words draft complete without distraction."
              </p>
              <div className="text-[10px] font-mono text-[var(--text-muted)]">
                Today at 07:15 AM
              </div>
            </div>

            {/* Tile 3: Witnessing */}
            <div className="bg-[var(--bg-viewport)] border border-[var(--border-default)] rounded-xl p-5 space-y-3 shadow-xs">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">
                03 · WITNESS INBOX
              </span>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-sage-subtle)] text-[var(--accent-sage)] flex items-center justify-center font-bold text-[10px]">
                  E
                </div>
                <span className="text-xs font-semibold text-[var(--text-primary)]">Elena Vance</span>
              </div>
              <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-[var(--accent-sage-subtle)] text-[var(--accent-sage)] rounded-full">
                ✓ Witnessed
              </span>
            </div>

            {/* Tile 4: Trust Score */}
            <div className="bg-[var(--bg-viewport)] border border-[var(--border-default)] rounded-xl p-5 space-y-3 shadow-xs">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">
                04 · TRUST SCORE
              </span>
              <div className="font-serif text-3xl font-bold text-[var(--text-primary)]">
                98%
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                42 verified check-ins across 3 commitments.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 7. FINAL CALM CTA                                                        */}
        {/* ========================================================================= */}
        <section className="py-12 sm:py-16 bg-[var(--bg-viewport)] border border-[var(--border-default)] rounded-3xl p-8 sm:p-12 text-center max-w-3xl mx-auto space-y-6 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[var(--accent-sage-subtle)] text-[var(--accent-sage)] mx-auto flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[var(--text-primary)] tracking-tight">
            Start with one promise.
          </h2>

          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
            No noise. No public feeds. Just the quiet satisfaction of being someone who does what they said they would do.
          </p>

          <div className="pt-2">
            <Link
              id="final-cta-btn"
              to={user ? '/home' : '/login'}
              className="inline-flex items-center gap-2 min-h-[44px] px-8 py-3.5 bg-[var(--text-primary)] text-[var(--bg-viewport)] rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.99] transition-all shadow-xs cursor-pointer"
            >
              <span>{user ? 'Open Your SANKALPA' : 'Begin your practice'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* 8. FOOTER                                                                */}
      {/* ========================================================================= */}
      <footer
        id="landing-footer"
        className="mt-20 border-t border-[var(--border-default)] bg-[var(--bg-viewport)] py-10 px-4 sm:px-8 text-xs text-[var(--text-muted)] transition-colors"
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="font-serif font-bold text-sm tracking-tight text-[var(--text-primary)]">
              SANKALPA
            </span>
            <span className="font-mono text-[11px] text-[var(--text-subtle)]">·</span>
            <span className="italic font-serif text-[11px] text-[var(--text-muted)]">
              "Keep your word."
            </span>
          </div>

          <div className="flex items-center gap-6 font-medium text-[var(--text-secondary)]">
            <button
              type="button"
              onClick={() => scrollToSection('hero')}
              className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Back to top
            </button>
            <Link
              to="/login"
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              Sign In
            </Link>
          </div>

          <div className="text-[11px] font-mono text-[var(--text-subtle)]">
            © {new Date().getFullYear()} SANKALPA. The practice of personal accountability.
          </div>
        </div>
      </footer>
    </div>
  );
}
