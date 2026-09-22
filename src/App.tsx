import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Landing from './pages/Landing.tsx';
import Home from './pages/Home.tsx';
import Onboarding from './pages/Onboarding.tsx';
import CommitmentDetail from './pages/CommitmentDetail.tsx';
import CircleDetail from './pages/CircleDetail.tsx';
import WitnessInbox from './pages/WitnessInbox.tsx';
import Settings from './pages/Settings.tsx';
import Profile from './pages/Profile.tsx';
import Login from './pages/Login.tsx';
import { Notifications } from './pages/Notifications.tsx';
import { NotificationBadge } from './components/shared/NotificationBadge.tsx';
import ProtectedRoute from './components/shared/ProtectedRoute.tsx';
import { AuthProvider, useAuth } from './hooks/useAuth.ts';
import { useUserProfile } from './hooks/useUserProfile.ts';
import { useResolvedAvatar } from './hooks/useResolvedAvatar.ts';
import { useCheckinDueNotifier } from './hooks/useCheckinDueNotifier.ts';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div id="root-loading" className="flex items-center justify-center min-h-[360px] p-6">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin"></div>
      </div>
    );
  }
  return <Navigate to={user ? '/home' : '/landing'} replace />;
}

function Layout() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile();
  const avatarDisplayUrl = useResolvedAvatar(profile?.avatarUrl);

  // Evaluate client-side check-in due reminders on app open
  useCheckinDueNotifier();

  const isLanding = location.pathname === '/landing';

  // For the public Landing experience, render full-width presentation canvas
  if (isLanding) {
    return (
      <div id="landing-container" className="min-h-screen bg-[var(--bg-app)]">
        <Landing />
      </div>
    );
  }

  const displayName = profile?.displayName || user?.displayName || 'User';
  const initial = (displayName.trim()[0] || 'U').toUpperCase();

  const navItems = [
    { label: 'Home', path: '/home', id: 'nav-home' },
    { label: 'Commitments', path: '/commitments', id: 'nav-commitments' },
    { label: 'Witness Inbox', path: '/witness-inbox', id: 'nav-witness-inbox' },
    { label: 'Circles', path: '/circles', id: 'nav-circles' },
  ];

  const isNavActive = (path: string) => {
    if (path === '/home') return location.pathname === '/home';
    return location.pathname.startsWith(path);
  };

  return (
    <div id="app-container" className="min-h-screen bg-neutral-100 flex justify-center text-neutral-900 antialiased">
      <div id="mobile-viewport" className="w-full max-w-[480px] min-h-screen bg-white shadow-sm flex flex-col relative pb-20">
        {/* Header */}
        <header id="app-header" className="sticky top-0 z-40 bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
          <Link id="brand-link" to="/home" className="text-xl font-bold tracking-tight text-neutral-900 hover:opacity-80 transition-opacity">
            SANKALPA
          </Link>
          <div className="flex items-center gap-2.5 text-xs text-neutral-500">
            {user ? (
              <>
                <NotificationBadge />
                <Link
                  id="header-avatar-link"
                  to="/profile"
                  className="flex items-center hover:opacity-80 transition-opacity"
                  title={`Profile (${displayName})`}
                  aria-label="Your Profile"
                >
                  {avatarDisplayUrl ? (
                    <img
                      id="header-avatar-img"
                      src={avatarDisplayUrl}
                      alt={displayName}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover border border-neutral-300 shadow-2xs"
                    />
                  ) : (
                    <div
                      id="header-avatar-initial"
                      className="w-7 h-7 rounded-full bg-neutral-900 text-white font-serif font-bold text-[11px] flex items-center justify-center border border-neutral-300 shadow-2xs"
                    >
                      {initial}
                    </div>
                  )}
                </Link>
                <Link id="header-link-settings" to="/settings" className="hover:text-neutral-900 transition-colors">
                  Settings
                </Link>
                <span>•</span>
                <button
                  id="header-btn-signout"
                  type="button"
                  onClick={() => signOut()}
                  className="hover:text-red-600 font-medium transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link id="header-link-login" to="/login" className="hover:text-neutral-900 font-semibold transition-colors">
                Sign In
              </Link>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main id="app-main" key={location.pathname} className="flex-1 overflow-y-auto page-transition">
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/commitments"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/commitments/:id"
              element={
                <ProtectedRoute>
                  <CommitmentDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/circles"
              element={
                <ProtectedRoute>
                  <CircleDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/circles/:id"
              element={
                <ProtectedRoute>
                  <CircleDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/witness-inbox"
              element={
                <ProtectedRoute>
                  <WitnessInbox />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </main>

        {/* Bottom Navigation Bar */}
        <nav
          id="app-bottom-nav"
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-neutral-200 z-50 px-2 py-2 flex items-center justify-around"
        >
          {navItems.map((item) => {
            const active = isNavActive(item.path);
            return (
              <Link
                key={item.path}
                id={item.id}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 text-xs font-medium transition-colors ${
                  active ? 'text-neutral-900 font-semibold' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout />
      </AuthProvider>
    </BrowserRouter>
  );
}
