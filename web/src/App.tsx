import { useState } from 'react';
import { HashRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/useAuth';
import { Splash } from './components/Splash';
import { BottomNav } from './components/BottomNav';
import { OfflineBanner } from './components/OfflineBanner';
import { SignIn } from './routes/SignIn';
import { Home } from './routes/Home';
import { Profile } from './routes/Profile';
import { Course } from './routes/Course';
import { Lesson } from './routes/Lesson';
import { Students } from './routes/admin/Students';
import { Courses } from './routes/admin/Courses';
import { DeviceBlocked, SetPassword } from './routes/Gates';
import { LOGO } from './lib/assets';

/**
 * Just the mark. Every destination moved to the bottom tab bar, so this no
 * longer carries navigation — it is an anchor, not a menu.
 */
function TopBar() {
  return (
    <header className="topbar">
      <div className="shell topbar__row">
        <Link to="/" aria-label="BNC Classes home">
          <img src={LOGO} alt="BNC" width={382} height={136} />
        </Link>
      </div>
    </header>
  );
}

/** Admin routes are guarded here for UX. The database refuses regardless. */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (profile.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function NotConfigured() {
  return (
    <div className="shell page">
      <h2>Not connected yet</h2>
      <p className="page__sub">
        This build has no Supabase credentials. Copy <code>.env.example</code> to{' '}
        <code>.env.local</code>, fill in the project URL and anon key, then restart the
        dev server.
      </p>
    </div>
  );
}

function Shell() {
  const { ready, session, configured, device, recovery } = useAuth();
  const [splashGone, setSplashGone] = useState(false);

  return (
    <>
      {!splashGone && <Splash ready={ready} onDone={() => setSplashGone(true)} />}

      {ready && !configured && <NotConfigured />}
      {ready && configured && !session && <SignIn />}

      {ready && configured && session && recovery && <SetPassword />}
      {ready && configured && session && !recovery && device === 'blocked' && <DeviceBlocked />}

      {ready && configured && session && !recovery && device !== 'blocked' && (
        <>
          <TopBar />
          <OfflineBanner />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/account" element={<Profile />} />
            <Route path="/course/:id" element={<Course />} />
            <Route path="/lesson/:id" element={<Lesson />} />
            <Route path="/admin" element={<RequireAdmin><Students /></RequireAdmin>} />
            <Route path="/admin/courses" element={<RequireAdmin><Courses /></RequireAdmin>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <BottomNav />
        </>
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AuthProvider>
  );
}
