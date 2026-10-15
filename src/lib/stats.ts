import type { Adjustment, AwayDay, DayResult, Holiday, LedgerRow, Profile, Settings, Snapshot, WeekPrize } from '../api/types';
import { addDays, weekStart } from './time';
import { dayClosed, isWorkingDay } from './rules';

export interface Agg {
  user_id: string;
  points: number;
  planned: number;
  done: number;
  failed: number;
  on_time: number;
  timed_sec: number;
  timed_est_sec: number;
  last_done_at: string | null;
}

function emptyAgg(user_id: string): Agg {
  return { user_id, points: 0, planned: 0, done: 0, failed: 0, on_time: 0, timed_sec: 0, timed_est_sec: 0, last_done_at: null };
}

/** Sum day results (and point adjustments) per person between from and to (inclusive). */
export function aggregate(days: DayResult[], adjustments: Adjustment[], from?: string, to?: string): Map<string, Agg> {
  const m = new Map<string, Agg>();
  const get = (u: string) => {
    let a = m.get(u);
    if (!a) { a = emptyAgg(u); m.set(u, a); }
    return a;
  };
  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
  for (const r of days) {
    if (!inRange(r.task_date)) continue;
    const a = get(r.user_id);
    a.points += r.points;
    a.planned += r.planned;
    a.done += r.done;
    a.failed += r.failed;
    a.on_time += r.on_time;
    a.timed_sec += r.timed_sec;
    a.timed_est_sec += r.timed_est_sec;
    if (r.last_done_at && (!a.last_done_at || r.last_done_at > a.last_done_at)) a.last_done_at = r.last_done_at;
  }
  for (const adj of adjustments) {
    if (!inRange(adj.day)) continue;
    get(adj.user_id).points += adj.points;
  }
  return m;
}

export function completionRate(a: Agg): number {
  const decided = a.done + a.failed;
  return decided ? a.done / decided : 0;
}

export interface RankRow extends Agg { rank: number; profile: Profile }

/** Points, then completion rate, then whoever finished their last task earliest. */
export function rank(profiles: Profile[], aggs: Map<string, Agg>): RankRow[] {
  const rows = profiles
    .filter((p) => p.active)
    .map((p) => ({ ...(aggs.get(p.id) ?? emptyAgg(p.id)), profile: p, rank: 0 }));
  rows.sort((a, b) =>
    b.points - a.points ||
    completionRate(b) - completionRate(a) ||
    (a.last_done_at ?? '9999').localeCompare(b.last_done_at ?? '9999') ||
    a.profile.display_name.localeCompare(b.profile.display_name),
  );
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && prev.points === r.points && completionRate(prev) === completionRate(r) ? prev.rank : i + 1;
  });
  return rows;
}

export interface Streak { current: number; best: number }

/**
 * A clean day = a working day with at least one task and no failed task.
 * Weekends, holidays and away days are skipped. Today only counts once it is closed.
 */
export function streakFor(
  userId: string,
  days: DayResult[],
  away: AwayDay[],
  holidays: Holiday[],
  today: string,
  nowMs: number,
  s: Settings,
): Streak {
  const mine = days.filter((d) => d.user_id === userId);
  if (!mine.length) return { current: 0, best: 0 };
  const byDate = new Map(mine.map((d) => [d.task_date, d]));
  const awaySet = new Set(away.filter((a) => a.user_id === userId).map((a) => a.day));
  let start = mine.reduce((m, d) => (d.task_date < m ? d.task_date : m), today);
  let current = 0;
  let best = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (!isWorkingDay(d, holidays) || awaySet.has(d)) continue;
    const r = byDate.get(d);
    if (d === today && !dayClosed(d, nowMs, s)) {
      // today still running: it only adds once everything is already done
      if (r && r.planned > 0 && r.done === r.planned) { current++; best = Math.max(best, current); }
      continue;
    }
    if (r && r.planned > 0 && r.failed === 0) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return { current, best };
}

export interface WeekWinner { week_start: string; user_id: string; points: number; prize: string }

/** Winners of every finished week, newest first. */
export function weeklyWinners(snap: Snapshot, today: string): WeekWinner[] {
  const thisWeek = weekStart(today);
  const weeks = new Set<string>();
  for (const d of snap.days) {
    const w = weekStart(d.task_date);
    if (w < thisWeek) weeks.add(w);
  }
  const out: WeekWinner[] = [];
  for (const w of [...weeks].sort().reverse()) {
    const rows = rank(snap.profiles, aggregate(snap.days, snap.adjustments, w, addDays(w, 6)));
    const top = rows[0];
    if (top && (top.planned > 0 || top.points !== 0)) {
      out.push({ week_start: w, user_id: top.profile.id, points: top.points, prize: prizeFor(snap.prizes, w) });
    }
  }
  return out;
}

export function prizeFor(prizes: WeekPrize[], week: string): string {
  return prizes.find((p) => p.week_start === week)?.prize ?? '';
}

export type BadgeKey =
  | 'first_bite' | 'perfect_day' | 'on_fire' | 'unstoppable' | 'sharp_shooter'
  | 'centurion' | 'weekly_champion' | 'good_sport' | 'cheerleader';

export const BADGES: { key: BadgeKey; icon: string }[] = [
  { key: 'first_bite', icon: '🍪' },
  { key: 'perfect_day', icon: '🎯' },
  { key: 'on_fire', icon: '🔥' },
  { key: 'unstoppable', icon: '⚡' },
  { key: 'sharp_shooter', icon: '🏹' },
  { key: 'centurion', icon: '💯' },
  { key: 'weekly_champion', icon: '🏆' },
  { key: 'good_sport', icon: '🤝' },
  { key: 'cheerleader', icon: '📣' },
];

export function badgesFor(
  userId: string,
  snap: Snapshot,
  streak: Streak,
  winners: WeekWinner[],
): Set<BadgeKey> {
  const out = new Set<BadgeKey>();
  const mine = snap.days.filter((d) => d.user_id === userId);
  const done = mine.reduce((n, d) => n + d.done, 0);
  const onTime = mine.reduce((n, d) => n + d.on_time, 0);
  if (done >= 1) out.add('first_bite');
  if (mine.some((d) => d.planned >= 3 && d.on_time === d.planned)) out.add('perfect_day');
  if (streak.best >= 5) out.add('on_fire');
  if (streak.best >= 20) out.add('unstoppable');
  if (onTime >= 10) out.add('sharp_shooter');
  if (done >= 100) out.add('centurion');
  if (winners.some((w) => w.user_id === userId)) out.add('weekly_champion');
  if (settledCount(snap.ledger, userId) >= 5) out.add('good_sport');
  if ((snap.reactionsGiven.find((r) => r.user_id === userId)?.n ?? 0) >= 50) out.add('cheerleader');
  return out;
}

function settledCount(ledger: LedgerRow[], userId: string): number {
  return ledger.filter((l) => l.user_id === userId && l.settled_at).length;
}
