import { useState, FormEvent } from 'react';
import { Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { isFirebaseConfigured, firebaseProjectId } from '../lib/firebase.ts';
import { RitualOrbital } from '../components/shared/RitualOrbital.tsx';

export default function Login() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInvalidCredential, setIsInvalidCredential] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // If already authenticated and not loading, redirect to intended destination or /home
  if (!loading && user) {
    const from = (location.state as any)?.from?.pathname || '/home';
    return <Navigate to={from} replace />;
  }

  // Prevent flashing login UI while verifying existing session
  if (loading) {
    return (
      <div id="login-session-loading" className="flex flex-col items-center justify-center min-h-[360px] p-6 text-center">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mb-3"></div>
        <p className="text-sm text-neutral-500 font-medium">Checking session...</p>
      </div>
    );
  }

  const mapAuthError = (err: any): { text: string; isInvalidCred: boolean } => {
    if (!err) return { text: '', isInvalidCred: false };
    const code = err?.code || '';
    const message = err?.message || '';

    if (code === 'auth/unauthorized-domain' || message.includes('auth/unauthorized-domain')) {
      return {
        text: `Domain not authorized. Please add "${window.location.hostname}" to Authorized Domains in your Firebase Console (Authentication > Settings > Authorized domains).`,
        isInvalidCred: false,
      };
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return {
        text: 'Incorrect email or password, or no account exists with this email yet.',
        isInvalidCred: true,
      };
    }
    if (code === 'auth/email-already-in-use') {
      return {
        text: 'An account with this email already exists. Please switch to "Sign In" above.',
        isInvalidCred: false,
      };
    }
    if (code === 'auth/weak-password') {
      return {
        text: 'Password should be at least 6 characters long.',
        isInvalidCred: false,
      };
    }
    if (code === 'auth/invalid-email') {
      return {
        text: 'Please enter a valid email address.',
        isInvalidCred: false,
      };
    }
    if (code === 'auth/network-request-failed') {
      return {
        text: 'Network connection failed. Please check your internet connection and try again.',
        isInvalidCred: false,
      };
    }
    if (code === 'auth/too-many-requests') {
      return {
        text: 'Access temporarily disabled due to multiple failed attempts. Please try again in a few minutes.',
        isInvalidCred: false,
      };
    }
    if (code === 'auth/popup-blocked') {
      return {
        text: 'Sign-in popup was blocked by your browser. Please allow popups for this site.',
        isInvalidCred: false,
      };
    }
    if (code === 'auth/invalid-api-key' || code === 'auth/api-key-not-valid' || message.includes('api-key')) {
      return {
        text: 'Firebase API key is invalid or unconfigured. Please configure .env.local with your Firebase project keys.',
        isInvalidCred: false,
      };
    }
    return {
      text: err?.message || 'Authentication could not be completed. Please try again.',
      isInvalidCred: false,
    };
  };

  const handleCopyDomain = async (domainToCopy: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(domainToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        return;
      }
    } catch {
      // Fallback below
    }

    try {
      const el = document.createElement('textarea');
      el.value = domainToCopy;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsInvalidCredential(false);
    setUnauthorizedDomain(null);
    setSubmitting(true);
    try {
      const result = await signInWithGoogle();
      if (result) {
        navigate('/home', { replace: true });
      }
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      const isUnauthorized =
        err?.code === 'auth/unauthorized-domain' || err?.message?.includes('auth/unauthorized-domain');
      if (isUnauthorized) {
        setUnauthorizedDomain(window.location.hostname);
        setErrorMsg(null);
      } else {
        const mapped = mapAuthError(err);
        setErrorMsg(mapped.text);
        setIsInvalidCredential(mapped.isInvalidCred);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg('Please enter both email and password.');
      setIsInvalidCredential(false);
      return;
    }

    if (isSignUp && password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      setIsInvalidCredential(false);
      return;
    }

    setErrorMsg(null);
    setIsInvalidCredential(false);
    setUnauthorizedDomain(null);
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(cleanEmail, password);
      } else {
        await signInWithEmail(cleanEmail, password);
      }
      navigate('/home', { replace: true });
    } catch (err: any) {
      console.error('Email auth error:', err);
      const mapped = mapAuthError(err);
      setErrorMsg(mapped.text);
      setIsInvalidCredential(mapped.isInvalidCred);
    } finally {
      setSubmitting(false);
    }
  };

  const switchToSignUp = () => {
    setIsSignUp(true);
    setErrorMsg(null);
    setIsInvalidCredential(false);
    setUnauthorizedDomain(null);
  };

  const switchToSignIn = () => {
    setIsSignUp(false);
    setErrorMsg(null);
    setIsInvalidCredential(false);
    setUnauthorizedDomain(null);
  };

  return (
    <div id="page-login" className="flex flex-col justify-center min-h-[calc(100vh-140px)] px-6 py-8">
      {/* Editorial Navigation Back to Philosophy / Landing */}
      <div className="mb-6 text-center">
        <Link
          id="link-back-to-landing"
          to="/landing"
          className="inline-flex items-center gap-1.5 text-xs font-mono tracking-wider uppercase text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
        >
          <span>← The Practice of SANKALPA</span>
        </Link>
      </div>

      {/* Branding Header with Subtle Ritual Orbital */}
      <div className="text-center mb-8 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 text-neutral-400 dark:text-neutral-600 opacity-20">
          <RitualOrbital size="sm" showNodes={false} />
        </div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          SANKALPA
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-mono">
          A modern ritual for keeping your word.
        </p>
      </div>

      {!isFirebaseConfigured && (
        <div
          id="firebase-config-notice"
          className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed"
        >
          <span className="font-semibold block mb-1">Firebase Setup Required</span>
          Add your Firebase web project credentials to <code className="bg-amber-100 px-1 py-0.5 rounded">.env.local</code> to connect live authentication.
        </div>
      )}

      {/* Unauthorized Domain Guidance Card */}
      {unauthorizedDomain && (
        <div
          id="unauthorized-domain-alert"
          className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl text-neutral-800 text-xs shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <div className="p-1 bg-amber-200 rounded-full text-amber-900 mt-0.5 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1 space-y-2.5">
              <div>
                <p className="font-bold text-amber-950 text-sm">Domain Authorization Required</p>
                <p className="text-neutral-700 mt-1 leading-relaxed">
                  Firebase rejected Google Sign-In because this domain is not yet on your project's authorized list.
                </p>
              </div>

              <div className="bg-white border border-amber-200 rounded-lg p-2 flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-neutral-800 break-all select-all font-medium">
                  {unauthorizedDomain}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyDomain(unauthorizedDomain)}
                  className="shrink-0 px-2.5 py-1 bg-neutral-900 text-white rounded text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div className="text-[11px] text-neutral-600 space-y-1">
                <p className="font-semibold text-neutral-800">How to authorize in 30 seconds:</p>
                <p>1. Open <strong>Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains</strong>.</p>
                <p>2. Click <strong>Add domain</strong> and paste the domain above.</p>
              </div>

              {firebaseProjectId && firebaseProjectId !== 'your-project-id' && (
                <div>
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 underline hover:text-amber-800"
                  >
                    Open Firebase Auth Settings &rarr;
                  </a>
                </div>
              )}

              <div className="pt-2 border-t border-amber-200 text-neutral-700 text-[11px]">
                💡 <em>Quick alternative: You can create an account or sign in with <strong>Email &amp; Password</strong> below right away without domain authorization!</em>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message with Smart Recovery */}
      {errorMsg && (
        <div
          id="login-error-alert"
          role="alert"
          className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium"
        >
          <p>{errorMsg}</p>
          {!isSignUp && isInvalidCredential && (
            <div className="mt-2.5 pt-2 border-t border-red-200/80 flex items-center justify-between gap-2">
              <span className="text-neutral-700 text-[11px]">First time here?</span>
              <button
                type="button"
                onClick={switchToSignUp}
                className="px-2.5 py-1 bg-red-600 text-white rounded font-semibold text-[11px] hover:bg-red-700 transition-colors cursor-pointer"
              >
                Create an account with this email &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {/* Google Sign In */}
      <button
        id="btn-google-signin"
        type="button"
        disabled={submitting}
        onClick={handleGoogleSignIn}
        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white border border-neutral-300 rounded-lg text-sm font-semibold text-neutral-700 shadow-xs hover:bg-neutral-50 active:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>{submitting ? 'Connecting...' : 'Continue with Google'}</span>
      </button>

      {/* Divider */}
      <div className="flex items-center my-6">
        <div className="flex-1 border-t border-neutral-200"></div>
        <span className="px-3 text-xs uppercase tracking-wider text-neutral-400 font-medium">or with email</span>
        <div className="flex-1 border-t border-neutral-200"></div>
      </div>

      {/* Segmented Auth Mode Switcher */}
      <div className="flex bg-neutral-100 p-1 rounded-lg mb-5 border border-neutral-200">
        <button
          id="tab-sign-in"
          type="button"
          onClick={switchToSignIn}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
            !isSignUp
              ? 'bg-white text-neutral-900 shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          Sign In
        </button>
        <button
          id="tab-sign-up"
          type="button"
          onClick={switchToSignUp}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
            isSignUp
              ? 'bg-white text-neutral-900 shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          Create Account
        </button>
      </div>

      {/* Email/Password Form */}
      <form id="form-email-auth" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="input-email" className="block text-xs font-semibold text-neutral-700 mb-1.5">
            Email address
          </label>
          <input
            id="input-email"
            type="email"
            required
            autoComplete="email"
            disabled={submitting}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3.5 py-2 text-sm bg-white border border-neutral-300 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed transition-all"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="input-password" className="block text-xs font-semibold text-neutral-700">
              Password
            </label>
            {isSignUp && (
              <span className="text-[11px] text-neutral-400">At least 6 characters</span>
            )}
          </div>
          <div className="relative">
            <input
              id="input-password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              disabled={submitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              className="w-full px-3.5 py-2 pr-10 text-sm bg-white border border-neutral-300 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 text-xs cursor-pointer"
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button
          id="btn-submit-auth"
          type="submit"
          disabled={submitting}
          className="w-full mt-2 py-2.5 px-4 bg-neutral-900 text-white rounded-lg text-sm font-semibold hover:bg-neutral-800 active:bg-neutral-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {submitting
            ? isSignUp
              ? 'Creating account...'
              : 'Signing in...'
            : isSignUp
            ? 'Create Account'
            : 'Sign In with Email'}
        </button>
      </form>

      {/* Switch between Sign In and Sign Up */}
      <div className="mt-5 text-center">
        <button
          id="btn-toggle-auth-mode"
          type="button"
          disabled={submitting}
          onClick={() => (isSignUp ? switchToSignIn() : switchToSignUp())}
          className="text-xs font-medium text-neutral-600 hover:text-neutral-900 underline underline-offset-4 transition-colors cursor-pointer"
        >
          {isSignUp
            ? 'Already have an account? Switch to Sign In'
            : "Don't have an account yet? Switch to Create Account"}
        </button>
      </div>
    </div>
  );
}
