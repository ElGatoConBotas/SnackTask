import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import { AppError } from './api/supabaseApi';
import type { Profile, Snapshot } from './api/types';
import { isKey, translate, type Key, type Lang } from './i18n';
import { lj } from './lib/time';
import { phaseOf, type Phase } from './lib/rules';
import { BADGES, badgesFor, streakFor, weeklyWinners, type BadgeKey, type Streak, type WeekWinner } from './lib/stats';

// ---------------------------------------------------------------- language
interface LangCtx { lang: Lang; setLang(l: Lang): void; t(k: Key, v?: Record<string, string | number>): string }
const LangContext = createContext<LangCtx>(null!);

function storedLang(): Lang {
  try { return localStorage.getItem('snacktask-lang') === 'en' ? 'en' : 'sl'; } catch { return 'sl'; }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(storedLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('snacktask-lang', l); } catch { /* ignore */ }
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t: (k: Key, v?: Record<string, string | number>) => translate(lang, k, v) }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
export const useLang = () => useContext(LangContext);

// ---------------------------------------------------------------- toasts
export interface Toast { id: number; text: string; kind: 'info' | 'error' | 'success' | 'badge'; icon?: string }
interface ToastCtx { toasts: Toast[]; toast(text: string, kind?: Toast['kind'], icon?: string): void; dismiss(id: number): void }
const ToastContext = createContext<ToastCtx>(null!);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((text: string, kind: Toast['kind'] = 'info', icon?: string) => {
    const id = next.current++;
    setToasts((t) => [...t.slice(-3), { id, text, kind, icon }]);
    setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 4000);
  }, [dismiss]);
  return <ToastContext.Provider value={{ toasts, toast, dismiss }}>{children}</ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);

// ---------------------------------------------------------------- clock
let clockOffset = 0; // server time minus this computer's time
export const now = () => Date.now() + clockOffset;

/** Re-renders every `ms` and returns the current (server-corrected) time. */
export function useNow(ms = 1000): number {
  const [t, setT] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setT(now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

// ---------------------------------------------------------------- app data
interface AppCtx {
  me: Profile;
  snap: Snapshot;
  today: string;
  phase: Phase;
  isAdmin: boolean;
  demo: boolean;
  profileOf(id: string | null | undefined): Profile | undefined;
  nameOf(id: string | null | undefined): string;
  streakOf(id: string): Streak;
  winners: WeekWinner[];
  badgesOf(id: string): Set<BadgeKey>;
  reload(): void;
  /** Runs an action, shows a translated error if it fails, then refreshes the data. */
  act<T>(fn: () => Promise<T>): Promise<T | undefined>;
  errorText(e: unknown): string;
}
const AppContext = createContext<AppCtx>(null!);
export const useApp = () => useContext(AppContext);

export function AppProvider({ me, snap, reload, children }: { me: Profile; snap: Snapshot; reload(): void; children: ReactNode }) {
  const { t } = useLang();
  const { toast } = useToast();
  const tick = useNow(15000);
  const today = lj(tick).date;
  const phase = phaseOf(tick, snap.settings, snap.holidays);

  const profiles = useMemo(() => new Map(snap.profiles.map((p) => [p.id, p])), [snap.profiles]);
  const streaks = useMemo(() => {
    const m = new Map<string, Streak>();
    for (const p of snap.profiles) m.set(p.id, streakFor(p.id, snap.days, snap.away, snap.holidays, today, tick, snap.settings));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, today, phase]);
  const winners = useMemo(() => weeklyWinners(snap, today), [snap, today]);
  const badgeCache = useMemo(() => new Map<string, Set<BadgeKey>>(), [snap, streaks, winners]);
  const badgesOf = useCallback((id: string) => {
    let b = badgeCache.get(id);
    if (!b) {
      b = badgesFor(id, snap, streaks.get(id) ?? { current: 0, best: 0 }, winners);
      badgeCache.set(id, b);
    }
    return b;
  }, [badgeCache, snap, streaks, winners]);

  // Toast when I earn a new badge (not on the very first load).
  useEffect(() => {
    const key = 'snacktask-badges-' + me.id;
    const mine = [...badgesOf(me.id)];
    try {
      const prev = localStorage.getItem(key);
      if (prev !== null) {
        const old = new Set(JSON.parse(prev) as string[]);
        for (const b of mine) {
          if (!old.has(b)) {
            const icon = BADGES.find((x) => x.key === b)?.icon;
            toast(t('badge.earned', { name: t(`badge.${b}` as Key) }), 'badge', icon);
          }
        }
      }
      localStorage.setItem(key, JSON.stringify(mine));
    } catch { /* storage blocked */ }
  }, [badgesOf, me.id, t, toast]);

  const errorText = useCallback((e: unknown) => {
    const code = e instanceof AppError ? e.code : 'unknown';
    const k = 'err.' + code;
    return isKey(k) ? t(k, { min: snap.settings.min_estimate, max: snap.settings.max_estimate }) : t('err.unknown');
  }, [t, snap.settings]);

  const act = useCallback(async <T,>(fn: () => Promise<T>) => {
    try {
      const r = await fn();
      reload();
      return r;
    } catch (e) {
      console.error(e);
      toast(errorText(e), 'error');
      reload();
      return undefined;
    }
  }, [reload, toast, errorText]);

  const value: AppCtx = {
    me, snap, today, phase,
    isAdmin: me.role === 'admin',
    demo: api.demo,
    profileOf: (id) => (id ? profiles.get(id) : undefined),
    nameOf: (id) => (id ? profiles.get(id)?.display_name : undefined) || t('common.someone'),
    streakOf: (id) => streaks.get(id) ?? { current: 0, best: 0 },
    winners,
    badgesOf,
    reload,
    act,
    errorText,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ---------------------------------------------------------------- session + loading
export type SessionState =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'notInvited' }
  | { kind: 'deactivated' }
  | { kind: 'error' }
  | { kind: 'ready'; me: Profile; snap: Snapshot };

export function useSession(): { state: SessionState; reload(): void; retry(): void } {
  const [state, setState] = useState<SessionState>({ kind: 'loading' });
  const busy = useRef(false);
  const again = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const { setLang } = useLang();

  const load = useCallback(async (first: boolean) => {
    if (busy.current) { again.current = true; return; }
    busy.current = true;
    try {
      const uid = await api.getUserId();
      if (!uid) { setState({ kind: 'signedOut' }); return; }
      if (first) {
        try {
          const before = Date.now();
          const server = await api.serverNow();
          clockOffset = server - (before + Date.now()) / 2;
          if (Math.abs(clockOffset) < 2000) clockOffset = 0;
        } catch { clockOffset = 0; }
      }
      const me = await api.ensureProfile();
      if (!me) { setState({ kind: 'notInvited' }); return; }
      if (!me.active) { setState({ kind: 'deactivated' }); return; }
      const snap = await api.loadAll(lj(now()).date);
      if (first) setLang(me.language);
      setState({ kind: 'ready', me: snap.profiles.find((p) => p.id === me.id) ?? me, snap });
    } catch (e) {
      console.error(e);
      setState((s) => (s.kind === 'ready' ? s : { kind: 'error' }));
    } finally {
      busy.current = false;
      if (again.current) { again.current = false; void load(false); }
    }
  }, [setLang]);

  const reload = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void load(false), 250);
  }, [load]);

  useEffect(() => {
    void load(true);
    const offAuth = api.onAuthChange(() => void load(true));
    const offLive = api.subscribe(reload);
    const every = window.setInterval(reload, 60000);
    const onFocus = () => reload();
    window.addEventListener('focus', onFocus);
    return () => { offAuth(); offLive(); window.clearInterval(every); window.removeEventListener('focus', onFocus); };
  }, [load, reload]);

  return { state, reload, retry: () => { setState({ kind: 'loading' }); void load(true); } };
}
