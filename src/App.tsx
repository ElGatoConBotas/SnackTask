import { useEffect } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, LangProvider, ToastProvider, useApp, useLang, useSession } from './state';
import { PhaseBadge, Toasts } from './components/ui';
import Login, { Blocked, Logo } from './pages/Login';
import Today from './pages/Today';
import Board from './pages/Board';
import Leaderboard from './pages/Leaderboard';
import Stats from './pages/Stats';
import Ledger from './pages/Ledger';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Tv from './pages/Tv';

function useTheme(theme: 'light' | 'dark') {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1C1F1E' : '#F6F3EE');
  }, [theme]);
}

function Shell() {
  const { me, isAdmin, demo, snap } = useApp();
  const { t } = useLang();
  useTheme(me.theme);
  const openLedger = snap.ledger.filter((l) => !l.settled_at && l.user_id === me.id).length;
  const myLooks = new Set([...snap.today, ...snap.myTasks].filter((x) => x.user_id === me.id).map((x) => x.id));
  const looks = snap.looks.filter((l) => !l.seen && myLooks.has(l.task_id)).length;

  const links = [
    { to: '/', label: t('nav.today'), icon: '✏️', badge: looks || '', end: true },
    { to: '/board', label: t('nav.board'), icon: '📋' },
    { to: '/leaderboard', label: t('nav.leaderboard'), icon: '🏆', desktopOnly: true },
    { to: '/stats', label: t('nav.stats'), icon: '📊', desktopOnly: true },
    { to: '/ledger', label: t('nav.ledger'), icon: '🍩', badge: openLedger || '' },
    { to: '/profile', label: t('nav.profile'), icon: '🙂' },
    ...(isAdmin ? [{ to: '/admin', label: t('nav.admin'), icon: '⚙️', desktopOnly: true }] : []),
  ];

  return (
    <div className="shell">
      {demo && <div className="demo-banner">{t('demo.banner')}</div>}
      <header className="topbar">
        <NavLink to="/" className="brand"><Logo /></NavLink>
        <nav className="topnav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="navlink">
              {l.label}{l.badge ? <span className="nav-badge">{l.badge}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-right"><PhaseBadge /></div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/board" element={<Board />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="tabbar">
        {links.filter((l) => !l.desktopOnly).map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className="tab">
            <span className="tab-icon" aria-hidden>{l.icon}</span>
            <span>{l.label}</span>
            {l.badge ? <span className="nav-badge">{l.badge}</span> : null}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Gate() {
  const { state, reload, retry } = useSession();
  const { t } = useLang();
  useTheme(state.kind === 'ready' ? state.me.theme : 'light');
  switch (state.kind) {
    case 'loading':
      return <div className="loading"><Logo big /><p className="muted">{t('common.loading')}</p></div>;
    case 'signedOut':
      return <Login />;
    case 'notInvited':
      return <Blocked text={t('login.notInvited')} onRetry={retry} />;
    case 'deactivated':
      return <Blocked text={t('login.deactivated')} />;
    case 'error':
      return <Blocked text={t('err.unknown')} onRetry={retry} />;
    case 'ready':
      return (
        <AppProvider me={state.me} snap={state.snap} reload={reload}>
          <Routes>
            <Route path="/tv" element={<Tv />} />
            <Route path="*" element={<Shell />} />
          </Routes>
        </AppProvider>
      );
  }
}

export default function App() {
  return (
    <LangProvider>
      <ToastProvider>
        <HashRouter>
          <Gate />
        </HashRouter>
        <Toasts />
      </ToastProvider>
    </LangProvider>
  );
}

