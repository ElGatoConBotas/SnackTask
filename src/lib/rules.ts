import type { BoardTask, DayResult, EffStatus, Holiday, RawTask, Settings } from '../api/types';
import { isoDow, lj, timeToSec } from './time';

export type Phase = 'nonworking' | 'planning' | 'working' | 'closed';

export function isWorkingDay(d: string, holidays: Holiday[]): boolean {
  return isoDow(d) < 6 && !holidays.some((h) => h.day === d);
}

export function phaseOf(nowMs: number, s: Settings, holidays: Holiday[]): Phase {
  const { date, seconds } = lj(nowMs);
  if (!isWorkingDay(date, holidays)) return 'nonworking';
  if (seconds < timeToSec(s.lock_time)) return 'planning';
  if (seconds < timeToSec(s.close_time)) return 'working';
  return 'closed';
}

/** Is the given day already finished (scored)? */
export function dayClosed(d: string, nowMs: number, s: Settings): boolean {
  const { date, seconds } = lj(nowMs);
  return d < date || (d === date && seconds >= timeToSec(s.close_time));
}

export function effStatus(t: RawTask, s: Settings, nowMs: number): EffStatus {
  if (t.status === 'done') return 'done';
  if (dayClosed(t.task_date, nowMs, s)) return 'failed';
  return t.status;
}

export function pointsFor(st: EffStatus, onTime: boolean, s: Settings): number {
  if (st === 'done') return s.points_done + (onTime ? s.points_on_time_bonus : 0);
  if (st === 'failed') return s.points_failed;
  return 0;
}

export function elapsedNow(t: Pick<BoardTask, 'elapsed_sec' | 'started_at' | 'status'>, nowMs: number): number {
  if (t.status === 'running' && t.started_at) {
    return t.elapsed_sec + Math.max(0, Math.floor((nowMs - Date.parse(t.started_at)) / 1000));
  }
  return t.elapsed_sec;
}

/** Same as the database view board_tasks (used by demo mode). */
export function toBoard(t: RawTask, me: string | null, s: Settings, nowMs: number): BoardTask {
  const eff = effStatus(t, s, nowMs);
  const hidden = t.is_private && t.user_id !== me;
  return {
    ...t,
    title: hidden ? null : t.title,
    stake: hidden && eff !== 'failed' ? null : t.stake,
    eff_status: eff,
    points: pointsFor(eff, t.on_time, s),
  };
}

/** Same as the database view day_results (used by demo mode). */
export function toDayResults(tasks: BoardTask[]): DayResult[] {
  const map = new Map<string, DayResult>();
  for (const t of tasks) {
    const k = t.user_id + '|' + t.task_date;
    let r = map.get(k);
    if (!r) {
      r = { user_id: t.user_id, task_date: t.task_date, planned: 0, done: 0, failed: 0, on_time: 0, points: 0, timed_sec: 0, timed_est_sec: 0, last_done_at: null };
      map.set(k, r);
    }
    r.planned++;
    r.points += t.points;
    if (t.eff_status === 'done') {
      r.done++;
      if (t.on_time) r.on_time++;
      if (t.used_timer) {
        r.timed_sec += t.elapsed_sec;
        r.timed_est_sec += t.estimate_min * 60;
      }
      if (t.finished_at && (!r.last_done_at || t.finished_at > r.last_done_at)) r.last_done_at = t.finished_at;
    }
    if (t.eff_status === 'failed') r.failed++;
  }
  return [...map.values()];
}
