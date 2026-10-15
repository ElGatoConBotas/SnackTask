import type { Agg, RankRow } from '../lib/stats';
import { aggregate, completionRate, rank } from '../lib/stats';
import { useApp, useLang } from '../state';
import { Avatar, Flame, Pct } from './ui';
import { weekStart, addDays } from '../lib/time';

const MEDAL = ['🥇', '🥈', '🥉'];

export function useWeekRows(): RankRow[] {
  const { snap, today } = useApp();
  const w = weekStart(today);
  return rank(snap.profiles, aggregate(snap.days, snap.adjustments, w, addDays(w, 6)));
}

export function useAllTimeRows(): RankRow[] {
  const { snap } = useApp();
  return rank(snap.profiles, aggregate(snap.days, snap.adjustments));
}

export function RankList({ rows, limit, big = false, detailed = false }: { rows: RankRow[]; limit?: number; big?: boolean; detailed?: boolean }) {
  const { me, streakOf } = useApp();
  const { t } = useLang();
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <ol className={`rank ${big ? 'rank-big' : ''}`}>
      {shown.map((r) => (
        <li key={r.profile.id} className={r.profile.id === me.id ? 'me' : ''}>
          <span className="rank-n">{r.rank <= 3 && r.points > 0 ? MEDAL[r.rank - 1] : r.rank}</span>
          <Avatar p={r.profile} size={big ? 44 : 30} />
          <span className="rank-name">
            {r.profile.display_name}
            {r.profile.id === me.id && <span className="muted small"> ({t('common.you')})</span>}
          </span>
          <Flame n={streakOf(r.profile.id).current} />
          {detailed && <span className="rank-extra muted"><Pct v={completionRate(r as Agg)} /></span>}
          <span className="rank-pts">{r.points}<small> {t('common.pts')}</small></span>
        </li>
      ))}
    </ol>
  );
}
