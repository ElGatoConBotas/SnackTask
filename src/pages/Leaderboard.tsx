import { useState } from 'react';
import { Avatar, Card, Empty, Pct } from '../components/ui';
import { useAllTimeRows, useWeekRows } from '../components/Rank';
import { completionRate, prizeFor } from '../lib/stats';
import { useApp, useLang } from '../state';
import { fmtDate, weekStart } from '../lib/time';

const MEDAL = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const { snap, today, winners, profileOf, me, streakOf } = useApp();
  const { t, lang } = useLang();
  const [tab, setTab] = useState<'week' | 'all'>('week');
  const week = useWeekRows();
  const all = useAllTimeRows();
  const rows = tab === 'week' ? week : all;
  const prize = prizeFor(snap.prizes, weekStart(today));

  return (
    <div className="page leaderboard">
      <header className="page-head"><h1>{t('lb.title')}</h1></header>

      {prize && (
        <Card className="prize">
          <span className="prize-icon" aria-hidden>🎁</span>
          <div><p className="eyebrow">{t('lb.prize')}</p><p className="prize-text">{prize}</p></div>
        </Card>
      )}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'week'} className={tab === 'week' ? 'on' : ''} onClick={() => setTab('week')}>{t('lb.week')}</button>
        <button role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>{t('lb.all')}</button>
      </div>

      <Card className="table-card">
        <table className="table">
          <thead>
            <tr><th>#</th><th>{t('stats.person')}</th><th className="num">{t('lb.points')}</th><th className="num hide-sm">{t('lb.completion')}</th><th className="num">{t('lb.streak')}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.profile.id} className={r.profile.id === me.id ? 'me' : ''}>
                <td className="rank-n">{r.rank <= 3 && r.points > 0 ? MEDAL[r.rank - 1] : r.rank}</td>
                <td><span className="who"><Avatar p={r.profile} size={30} />{r.profile.display_name}</span></td>
                <td className="num strong">{r.points}</td>
                <td className="num hide-sm"><Pct v={completionRate(r)} /></td>
                <td className="num">{streakOf(r.profile.id).current ? `🔥 ${streakOf(r.profile.id).current}` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2>🏆 {t('lb.hall')}</h2>
        {winners.length === 0 ? <Empty icon="🏆">{t('lb.hallEmpty')}</Empty> : (
          <ul className="hall">
            {winners.map((w) => (
              <li key={w.week_start}>
                <Avatar p={profileOf(w.user_id)} size={34} />
                <div>
                  <strong>{profileOf(w.user_id)?.display_name}</strong> · {w.points} {t('common.points')}
                  <div className="muted small">{t('lb.weekOf', { d: fmtDate(w.week_start, lang, false) })}{w.prize && ` · 🎁 ${w.prize}`}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
