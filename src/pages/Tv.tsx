import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PersonCard, useBoardPeople } from './Board';
import { RankList, useWeekRows } from '../components/Rank';
import { PhaseText } from '../components/ui';
import { useApp, useLang, useNow } from '../state';
import { fmtClock, fmtDate, lj } from '../lib/time';

export default function Tv() {
  const { snap, today, phase, nameOf } = useApp();
  const { t, lang } = useLang();
  const tick = useNow(1000);
  const { byUser, withTasks } = useBoardPeople();
  const weekRows = useWeekRows();

  const boardRef = useRef<HTMLElement>(null);
  // Slowly scroll the board when it does not fit on the screen.
  useEffect(() => {
    let pause = 120;
    const id = window.setInterval(() => {
      const el = boardRef.current;
      if (!el || el.scrollHeight <= el.clientHeight + 4) return;
      if (pause > 0) { pause--; return; }
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) { el.scrollTop = 0; pause = 160; return; }
      el.scrollTop += 1;
    }, 50);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.tv = '1';
    return () => { delete document.documentElement.dataset.tv; };
  }, []);

  const recent = snap.activity
    .filter((a) => a.kind === 'done' && lj(Date.parse(a.created_at)).date === today)
    .slice(0, 12)
    .map((a) => (a.on_time ? '⭐ ' + t('tv.finishedOnTime', { name: nameOf(a.user_id) }) : '✓ ' + t('tv.finished', { name: nameOf(a.user_id) })));
  const misses = phase === 'closed'
    ? snap.today.filter((x) => x.eff_status === 'failed').map((x) => '🍩 ' + t('tv.missed', { name: nameOf(x.user_id), stake: x.stake ?? '' }))
    : [];
  const ticker = [...misses, ...recent];

  return (
    <div className="tv">
      <header className="tv-head">
        <Link to="/board" className="tv-logo">SnackTask</Link>
        <span className="tv-date">{fmtDate(today, lang)}</span>
        <span className={`phase phase-${phase}`}><span className="dot" /> <PhaseText /></span>
        <span className="tv-clock">{fmtClock(tick)}</span>
      </header>
      <main className="tv-main">
        <section className="tv-board" ref={boardRef}>
          {withTasks.map((p) => <PersonCard key={p.id} p={p} tasks={byUser.get(p.id)!} interactive={false} />)}
        </section>
        <aside className="tv-side">
          <h2>🏆 {t('board.weekTop')}</h2>
          <RankList rows={weekRows} limit={10} big />
        </aside>
      </main>
      <footer className="tv-ticker" aria-live="off">
        {ticker.length > 0 && (
          <div className="ticker-track" style={{ animationDuration: `${Math.max(20, ticker.length * 6)}s` }}>
            {[...ticker, ...ticker].map((x, i) => <span key={i}>{x}</span>)}
          </div>
        )}
      </footer>
    </div>
  );
}
