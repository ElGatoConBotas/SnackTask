import { useEffect, useState } from 'react';
import { api } from '../api';
import type { BoardTask } from '../api/types';
import { Avatar, Card, Empty, Pct } from '../components/ui';
import { aggregate, completionRate, rank, type Agg } from '../lib/stats';
import { useApp, useLang } from '../state';
import { addDays, fmtDate, weekStart } from '../lib/time';

function accuracy(a: Agg): number | null {
  return a.timed_est_sec ? a.timed_sec / a.timed_est_sec : null;
}

function hours(sec: number): string {
  return (sec / 3600).toFixed(1).replace('.', ',') + ' h';
}

export default function Stats() {
  const { snap, today } = useApp();
  const { t, lang } = useLang();
  const [week, setWeek] = useState(weekStart(today));
  const [tasks, setTasks] = useState<BoardTask[] | null>(null);
  const end = addDays(week, 6);

  useEffect(() => {
    let on = true;
    setTasks(null);
    api.tasksInRange(week, end).then((x) => on && setTasks(x)).catch(() => on && setTasks([]));
    return () => { on = false; };
  }, [week, end]);

  const rows = rank(snap.profiles, aggregate(snap.days, snap.adjustments, week, end)).filter((r) => r.planned > 0 || r.points !== 0);
  const office = rows.reduce<Agg>((s, r) => ({
    ...s,
    points: s.points + r.points, planned: s.planned + r.planned, done: s.done + r.done, failed: s.failed + r.failed,
    on_time: s.on_time + r.on_time, timed_sec: s.timed_sec + r.timed_sec, timed_est_sec: s.timed_est_sec + r.timed_est_sec,
  }), { user_id: '', points: 0, planned: 0, done: 0, failed: 0, on_time: 0, timed_sec: 0, timed_est_sec: 0, last_done_at: null });

  const stakeCount = new Map<string, number>();
  for (const x of tasks ?? []) if (x.stake) stakeCount.set(x.stake, (stakeCount.get(x.stake) ?? 0) + 1);
  const topStake = [...stakeCount].sort((a, b) => b[1] - a[1])[0]?.[0];
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.points)));
  const acc = accuracy(office);

  return (
    <div className="page stats">
      <header className="page-head">
        <h1>{t('stats.title')}</h1>
        <div className="week-pick">
          <button className="btn ghost small" onClick={() => setWeek(addDays(week, -7))} aria-label={t('stats.prev')}>←</button>
          <span>{fmtDate(week, lang, false)} – {fmtDate(end, lang, false)}</span>
          <button className="btn ghost small" disabled={week >= weekStart(today)} onClick={() => setWeek(addDays(week, 7))} aria-label={t('stats.next')}>→</button>
        </div>
      </header>

      {rows.length === 0 ? <Card><Empty icon="📊">{t('stats.empty')}</Empty></Card> : (
        <>
          <h2 className="section-title">{t('stats.office')}</h2>
          <div className="tiles">
            <div className="tile"><span className="tile-n">{office.planned}</span><span className="tile-l">{t('stats.planned')}</span></div>
            <div className="tile c-sage"><span className="tile-n">{office.done}</span><span className="tile-l">{t('stats.done')}</span></div>
            <div className="tile c-coral"><span className="tile-n">{office.failed}</span><span className="tile-l">{t('stats.failed')}</span></div>
            <div className="tile"><span className="tile-n"><Pct v={completionRate(office)} /></span><span className="tile-l">{t('stats.completion')}</span></div>
            <div className="tile c-butter"><span className="tile-n">{office.points}</span><span className="tile-l">{t('stats.points')}</span></div>
            <div className="tile c-lavender"><span className="tile-n">{hours(office.timed_sec)}</span><span className="tile-l">{t('stats.timed')}</span></div>
            <div className="tile c-sky" title={t('stats.accuracyHelp')}><span className="tile-n">{acc === null ? '–' : <Pct v={acc} />}</span><span className="tile-l">{t('stats.accuracy')} ⓘ</span></div>
            <div className="tile c-peach"><span className="tile-n tile-text">{tasks === null ? '…' : topStake ?? '–'}</span><span className="tile-l">{t('stats.topStake')}</span></div>
          </div>

          <Card>
            <h2>{t('stats.pointsChart')}</h2>
            <div className="bars" role="img" aria-label={t('stats.pointsChart')}>
              {rows.map((r) => (
                <div className="bar-row" key={r.profile.id}>
                  <span className="bar-label">{r.profile.display_name}</span>
                  <span className="bar-track">
                    <span className={`bar c-${r.profile.avatar_color} ${r.points < 0 ? 'neg' : ''}`} style={{ width: `${(Math.abs(r.points) / maxAbs) * 100}%` }} />
                  </span>
                  <span className="bar-val">{r.points}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('stats.person')}</th>
                  <th className="num">{t('stats.planned')}</th>
                  <th className="num">{t('stats.done')}</th>
                  <th className="num">{t('stats.failed')}</th>
                  <th className="num hide-sm">{t('stats.completion')}</th>
                  <th className="num hide-sm">{t('stats.timed')}</th>
                  <th className="num hide-sm" title={t('stats.accuracyHelp')}>{t('stats.accuracy')}</th>
                  <th className="num">{t('stats.points')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const a = accuracy(r);
                  return (
                    <tr key={r.profile.id}>
                      <td><span className="who"><Avatar p={r.profile} size={28} />{r.profile.display_name}</span></td>
                      <td className="num">{r.planned}</td>
                      <td className="num">{r.done}</td>
                      <td className="num">{r.failed}</td>
                      <td className="num hide-sm"><Pct v={completionRate(r)} /></td>
                      <td className="num hide-sm">{hours(r.timed_sec)}</td>
                      <td className="num hide-sm">{a === null ? '–' : <Pct v={a} />}</td>
                      <td className="num strong">{r.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
