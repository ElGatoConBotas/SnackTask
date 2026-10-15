import type { ReactNode } from 'react';
import type { BoardTask, Profile } from '../api/types';
import { useApp, useLang, useNow, useToast } from '../state';
import { fmtCountdown, hhmm, lj, timeToSec } from '../lib/time';
import type { Key } from '../i18n';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export function Avatar({ p, size = 36 }: { p?: Profile; size?: number }) {
  if (!p) return <span className="avatar" style={{ width: size, height: size }} />;
  return (
    <span
      className={`avatar c-${p.avatar_color}`}
      style={{ width: size, height: size, fontSize: p.avatar_emoji ? size * 0.5 : size * 0.38 }}
      aria-hidden
    >
      {p.avatar_emoji || initials(p.display_name)}
    </span>
  );
}

const STATUS_ICON: Record<string, string> = { planned: '○', running: '▶', paused: '❚❚', done: '✓', onTime: '★', failed: '✕' };

export function statusKey(t: Pick<BoardTask, 'eff_status' | 'on_time'>): 'planned' | 'running' | 'paused' | 'done' | 'onTime' | 'failed' {
  if (t.eff_status === 'done') return t.on_time ? 'onTime' : 'done';
  return t.eff_status;
}

export function StatusChip({ task }: { task: Pick<BoardTask, 'eff_status' | 'on_time'> }) {
  const { t } = useLang();
  const k = statusKey(task);
  return (
    <span className={`chip status-${k}`}>
      <span aria-hidden>{STATUS_ICON[k]}</span> {t(`status.${k}` as Key)}
    </span>
  );
}

export function Flame({ n }: { n: number }) {
  const { t } = useLang();
  if (n < 1) return null;
  const size = n >= 20 ? 'xl' : n >= 5 ? 'lg' : 'sm';
  return (
    <span className={`flame flame-${size}`} title={t('board.streak', { n })}>
      <span aria-hidden>🔥</span>{n}
    </span>
  );
}

/** "Planning locks in 23 min" style banner text with a live countdown. */
export function PhaseText({ compact = false }: { compact?: boolean }) {
  const { snap, phase } = useApp();
  const { t } = useLang();
  const tick = useNow(1000);
  const sec = lj(tick).seconds;
  if (phase === 'planning') {
    const left = timeToSec(snap.settings.lock_time) - sec;
    return <>{compact ? t('phase.lockAt', { t: hhmm(snap.settings.lock_time) }) : t('phase.planning', { t: fmtCountdown(left) })}</>;
  }
  if (phase === 'working') {
    const left = timeToSec(snap.settings.close_time) - sec;
    return <>{compact ? t('phase.closeAt', { t: hhmm(snap.settings.close_time) }) : t('phase.working', { t: fmtCountdown(left) })}</>;
  }
  return <>{t(phase === 'closed' ? 'phase.closed' : 'phase.nonworking')}</>;
}

export function PhaseBadge() {
  const { phase } = useApp();
  return (
    <span className={`phase phase-${phase}`}>
      <span className="dot" />
      <span className="phase-long"><PhaseText /></span>
      <span className="phase-short"><PhaseText compact /></span>
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Empty({ children, icon = '🍩' }: { children: ReactNode; icon?: string }) {
  return <div className="empty"><span className="empty-icon" aria-hidden>{icon}</span><p>{children}</p></div>;
}

export function Toasts() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((x) => (
        <button key={x.id} className={`toast toast-${x.kind}`} onClick={() => dismiss(x.id)}>
          {x.icon && <span className="toast-icon" aria-hidden>{x.icon}</span>}
          {x.text}
        </button>
      ))}
    </div>
  );
}

export function Pct({ v }: { v: number }) {
  return <>{Math.round(v * 100)} %</>;
}
