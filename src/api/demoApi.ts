// Demo mode: the whole app runs in this browser with made-up colleagues.
// It is used when no Supabase keys are configured, so you can try SnackTask
// before setting anything up. It follows the same rules as the database.
import type {
  Activity, Adjustment, Api, AwayDay, Color, Emoji, Holiday, Invite, LookRequest, Profile, RawTask,
  Reaction, Settings, TaskInput, WeekPrize,
} from './types';
import { AppError } from './supabaseApi';
import { addDays, isoDow, lj, timeToSec } from '../lib/time';
import { effStatus, isWorkingDay, toBoard, toDayResults } from '../lib/rules';

const KEY = 'snacktask-demo-v1';
const ME = 'me';

interface Store {
  loggedIn: boolean;
  settings: Settings;
  profiles: Profile[];
  tasks: RawTask[];
  reactions: (Reaction & { created_at: string })[];
  looks: LookRequest[];
  settlements: { task_id: string; settled_by: string; note: string; settled_at: string }[];
  away: AwayDay[];
  holidays: Holiday[];
  adjustments: Adjustment[];
  prizes: WeekPrize[];
  invites: Invite[];
  activity: Activity[];
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const TITLES = [
  'Pripraviti ponudbo za stranko', 'Mesečno poročilo', 'Odgovoriti na nujno pošto', 'Zapisnik sestanka',
  'Pregled pogodbe', 'Posodobiti spletno stran', 'Klic dobavitelju', 'Urediti račune', 'Načrt za Q4',
  'Predstavitev za vodstvo', 'Testiranje nove funkcije', 'Arhiviranje dokumentov', 'Priprava na delavnico',
  'Analiza prodaje', 'Objava na LinkedIn', 'Inventura skladišča',
];

function iso(dayStr: string, secOfDay: number): string {
  // approximate: Ljubljana is UTC+1/+2; demo only needs a plausible timestamp
  const d = new Date(dayStr + 'T00:00:00Z');
  return new Date(d.getTime() + (secOfDay - 2 * 3600) * 1000).toISOString();
}

function seed(): Store {
  const r = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const people: [string, string, Color, string][] = [
    [ME, 'Ti', 'sage', '😎'],
    ['u1', 'Ana Kovač', 'peach', '🌸'],
    ['u2', 'Luka Novak', 'sky', ''],
    ['u3', 'Maja Horvat', 'lavender', '🎧'],
    ['u4', 'Nejc Krajnc', 'butter', '⚡'],
    ['u5', 'Petra Zupan', 'coral', ''],
    ['u6', 'Tilen Potočnik', 'sage', '🚲'],
    ['u7', 'Eva Mlakar', 'sky', '☕'],
    ['u8', 'Jure Kos', 'peach', ''],
  ];
  const profiles: Profile[] = people.map(([id, name, color, emoji]) => ({
    id, email: id === ME ? 'ti@pisarna.si' : name.split(' ')[0].toLowerCase() + '@pisarna.si',
    display_name: name, avatar_color: color, avatar_emoji: emoji, role: id === ME ? 'admin' : 'member',
    language: 'sl', theme: 'light', active: true,
  }));
  const settings: Settings = {
    max_tasks: 5, min_estimate: 15, max_estimate: 480, lock_time: '23:00:00', close_time: '23:30:00',
    points_done: 5, points_on_time_bonus: 5, points_failed: -5,
    stake_presets: ['Prigrizek za pisarno', 'Runda kave', 'Torta', 'Košara sadja', 'Pomijem skodelice'],
  };
  const today = lj(Date.now()).date;
  const nowSec = lj(Date.now()).seconds;
  const tasks: RawTask[] = [];
  const activity: Activity[] = [];
  const skill: Record<string, number> = { u1: 0.92, u2: 0.75, u3: 0.88, u4: 0.7, u5: 0.82, u6: 0.6, u7: 0.95, u8: 0.78, [ME]: 0.85 };

  // past 20 calendar days
  for (let back = 20; back >= 1; back--) {
    const day = addDays(today, -back);
    if (isoDow(day) > 5) continue;
    for (const p of profiles) {
      if (r() < 0.08) continue;
      const n = 2 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const est = pick([15, 30, 45, 60, 90, 120]);
        const done = r() < skill[p.id];
        const timer = r() < 0.8;
        const ratio = 0.6 + r() * 0.8;
        const elapsed = timer && done ? Math.round(est * 60 * ratio) : 0;
        tasks.push({
          id: uid(), user_id: p.id, task_date: day, title: pick(TITLES), estimate_min: est,
          stake: pick(settings.stake_presets), is_private: r() < 0.1, status: done ? 'done' : 'planned',
          started_at: null, elapsed_sec: elapsed, used_timer: timer && done, on_time: timer && done && ratio <= 1,
          finished_at: done ? iso(day, 9 * 3600 + Math.floor(r() * 7 * 3600)) : null,
          created_at: iso(day, 8 * 3600 + i * 60),
        });
      }
    }
  }

  // today
  const away: AwayDay[] = [];
  const reactions: Store['reactions'] = [];
  if (isWorkingDay(today, [])) {
    away.push({ user_id: 'u8', day: today });
    for (const p of profiles) {
      if (p.id === ME || p.id === 'u8') continue;
      const n = 2 + Math.floor(r() * 4);
      let running = false;
      for (let i = 0; i < n; i++) {
        const est = pick([30, 45, 60, 90, 120]);
        const roll = r();
        const done = roll < 0.45 && nowSec > 9 * 3600;
        const isRunning = !done && !running && roll < 0.75;
        if (isRunning) running = true;
        const ratio = 0.5 + r() * 0.8;
        const t: RawTask = {
          id: uid(), user_id: p.id, task_date: today, title: pick(TITLES), estimate_min: est,
          stake: pick(settings.stake_presets), is_private: r() < 0.15,
          status: done ? 'done' : isRunning ? 'running' : 'planned',
          started_at: isRunning ? new Date(Date.now() - Math.floor(r() * 40 + 5) * 60000).toISOString() : null,
          elapsed_sec: done ? Math.round(est * 60 * ratio) : isRunning ? Math.round(r() * 600) : 0,
          used_timer: done || isRunning, on_time: done && ratio <= 1,
          finished_at: done ? new Date(Date.now() - Math.floor(r() * 120 + 3) * 60000).toISOString() : null,
          created_at: iso(today, 8 * 3600 + i * 60),
        };
        tasks.push(t);
        if (done) {
          activity.push({ id: activity.length + 1, kind: 'done', user_id: p.id, task_id: t.id, on_time: t.on_time, created_at: t.finished_at! });
          const emojis: Emoji[] = ['clap', 'fire', 'muscle', 'rocket', 'laugh', 'donut'];
          for (const other of profiles) {
            if (other.id !== p.id && r() < 0.25) reactions.push({ task_id: t.id, user_id: other.id, emoji: pick(emojis), created_at: t.finished_at! });
          }
        }
      }
    }
  }
  // dedupe reactions
  const seen = new Set<string>();
  const uniqReactions = reactions.filter((x) => {
    const k = x.task_id + x.user_id + x.emoji;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // settle about half of the past failures
  const settlements: Store['settlements'] = [];
  for (const t of tasks) {
    if (t.task_date < today && t.status !== 'done' && r() < 0.55) {
      settlements.push({ task_id: t.id, settled_by: t.user_id, note: r() < 0.5 ? 'Prinesel/-a krofe 🍩' : '', settled_at: iso(addDays(t.task_date, 1), 10 * 3600) });
    }
  }
  return {
    loggedIn: false, settings, profiles, tasks, reactions: uniqReactions, looks: [], settlements, away,
    holidays: [], adjustments: [], prizes: [], invites: profiles.map((p) => ({ email: p.email, is_admin: p.role === 'admin' })),
    activity: activity.sort((a, b) => a.created_at.localeCompare(b.created_at)).map((a, i) => ({ ...a, id: i + 1 })),
  };
}

export function demoApi(): Api {
  let store: Store;
  try {
    const raw = localStorage.getItem(KEY);
    store = raw ? JSON.parse(raw) : seed();
  } catch {
    store = seed();
  }
  const listeners = new Set<() => void>();
  const authListeners = new Set<() => void>();
  const authChanged = () => setTimeout(() => authListeners.forEach((l) => l()), 0);
  const save = (kind = 'change', task_id: string | null = null, on_time: boolean | null = null) => {
    store.activity.push({ id: (store.activity.at(-1)?.id ?? 0) + 1, kind, user_id: ME, task_id, on_time, created_at: new Date().toISOString() });
    store.activity = store.activity.slice(-200);
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage full or blocked */ }
    setTimeout(() => listeners.forEach((l) => l()), 0);
  };
  const today = () => lj(Date.now()).date;
  const nowSec = () => lj(Date.now()).seconds;
  const s = () => store.settings;
  const fail = (code: string): never => { throw new AppError(code); };
  const delay = () => new Promise((r) => setTimeout(r, 120));

  const planningOpen = () => {
    if (!isWorkingDay(today(), store.holidays)) fail('not_working_day');
    if (store.away.some((a) => a.user_id === ME && a.day === today())) fail('away_today');
    if (nowSec() >= timeToSec(s().lock_time)) fail('locked');
  };
  const checkFields = (t: TaskInput) => {
    if (!t.title.trim() || t.title.trim().length > 120) fail('bad_title');
    if (!t.stake.trim() || t.stake.trim().length > 80) fail('bad_stake');
    if (!(t.estimate >= s().min_estimate && t.estimate <= s().max_estimate)) fail('bad_estimate');
  };
  const myTask = (id: string) => store.tasks.find((t) => t.id === id && t.user_id === ME) ?? fail('not_found');
  const dayOpen = (t: RawTask) => {
    if (t.task_date !== today() || nowSec() >= timeToSec(s().close_time)) fail('closed');
  };
  const accumulate = (t: RawTask) => {
    if (t.status === 'running' && t.started_at) {
      t.elapsed_sec += Math.max(0, Math.floor((Date.now() - Date.parse(t.started_at)) / 1000));
    }
    t.started_at = null;
  };
  const board = () => store.tasks.map((t) => toBoard(t, ME, s(), Date.now()));

  return {
    demo: true,
    async getUserId() { return store.loggedIn ? ME : null; },
    onAuthChange(cb) { authListeners.add(cb); return () => { authListeners.delete(cb); }; },
    async sendCode() { await delay(); },
    async verifyCode() { store.loggedIn = true; save('login'); authChanged(); },
    async signOut() { store.loggedIn = false; save('logout'); authChanged(); },
    async ensureProfile() { return store.profiles.find((p) => p.id === ME) ?? null; },
    async serverNow() { return Date.now(); },

    async loadAll(day) {
      await delay();
      const all = board();
      const todayTasks = all.filter((t) => t.task_date === day);
      const ids = new Set(todayTasks.map((t) => t.id));
      const ledger = all.filter((t) => t.eff_status === 'failed').map((t) => {
        const st = store.settlements.find((x) => x.task_id === t.id);
        return { task_id: t.id, user_id: t.user_id, task_date: t.task_date, title: t.title, is_private: t.is_private, stake: t.stake,
          settled_by: st?.settled_by ?? null, note: st?.note ?? null, settled_at: st?.settled_at ?? null };
      }).sort((a, b) => b.task_date.localeCompare(a.task_date));
      const given = new Map<string, number>();
      for (const r of store.reactions) given.set(r.user_id, (given.get(r.user_id) ?? 0) + 1);
      const lookIds = new Set(store.looks.map((l) => l.task_id));
      return {
        settings: { ...s() },
        profiles: [...store.profiles].sort((a, b) => a.display_name.localeCompare(b.display_name)),
        today: todayTasks,
        myTasks: all.filter((t) => t.user_id === ME && lookIds.has(t.id)),
        reactions: store.reactions.filter((r) => ids.has(r.task_id)).map(({ task_id, user_id, emoji }) => ({ task_id, user_id, emoji })),
        looks: [...store.looks],
        days: toDayResults(all),
        adjustments: [...store.adjustments],
        ledger,
        away: [...store.away],
        holidays: [...store.holidays],
        prizes: [...store.prizes],
        reactionsGiven: [...given].map(([user_id, n]) => ({ user_id, n })),
        activity: [...store.activity].reverse().slice(0, 40),
      };
    },

    async tasksInRange(from, to) {
      return board().filter((t) => t.task_date >= from && t.task_date <= to);
    },

    async addTask(t) {
      planningOpen();
      checkFields(t);
      if (store.tasks.filter((x) => x.user_id === ME && x.task_date === today()).length >= s().max_tasks) fail('too_many_tasks');
      const id = uid();
      store.tasks.push({
        id, user_id: ME, task_date: today(), title: t.title.trim(), estimate_min: t.estimate, stake: t.stake.trim(),
        is_private: t.isPrivate, status: 'planned', started_at: null, elapsed_sec: 0, used_timer: false, on_time: false,
        finished_at: null, created_at: new Date().toISOString(),
      });
      save('plan', id);
    },
    async editTask(id, t) {
      planningOpen();
      checkFields(t);
      const x = myTask(id);
      if (x.task_date !== today() || x.status === 'done') fail('not_found');
      Object.assign(x, { title: t.title.trim(), estimate_min: t.estimate, stake: t.stake.trim(), is_private: t.isPrivate });
      save('edit', id);
    },
    async deleteTask(id) {
      planningOpen();
      const x = myTask(id);
      if (x.task_date !== today() || x.status === 'done') fail('not_found');
      store.tasks = store.tasks.filter((t) => t.id !== id);
      save('delete', id);
    },
    async startTask(id) {
      const x = myTask(id);
      dayOpen(x);
      if (x.status !== 'planned' && x.status !== 'paused') fail('bad_state');
      for (const o of store.tasks) {
        if (o.user_id === ME && o.status === 'running' && o.id !== id) { accumulate(o); o.status = 'paused'; }
      }
      x.status = 'running';
      x.started_at = new Date().toISOString();
      x.used_timer = true;
      save('start', id);
    },
    async pauseTask(id) {
      const x = myTask(id);
      dayOpen(x);
      if (x.status !== 'running') fail('bad_state');
      accumulate(x);
      x.status = 'paused';
      save('pause', id);
    },
    async finishTask(id) {
      const x = myTask(id);
      dayOpen(x);
      if (x.status === 'done') fail('bad_state');
      accumulate(x);
      x.status = 'done';
      x.finished_at = new Date().toISOString();
      x.on_time = x.used_timer && x.elapsed_sec <= x.estimate_min * 60;
      save('done', id, x.on_time);
      return x.on_time;
    },
    async setAway(on) {
      if (!isWorkingDay(today(), store.holidays)) fail('not_working_day');
      if (nowSec() >= timeToSec(s().lock_time)) fail('locked');
      if (on) {
        if (store.tasks.some((t) => t.user_id === ME && t.task_date === today())) fail('has_tasks');
        if (!store.away.some((a) => a.user_id === ME && a.day === today())) store.away.push({ user_id: ME, day: today() });
      } else {
        store.away = store.away.filter((a) => !(a.user_id === ME && a.day === today()));
      }
      save('away');
    },
    async toggleReaction(taskId, emoji) {
      const i = store.reactions.findIndex((r) => r.task_id === taskId && r.user_id === ME && r.emoji === emoji);
      if (i >= 0) store.reactions.splice(i, 1);
      else store.reactions.push({ task_id: taskId, user_id: ME, emoji, created_at: new Date().toISOString() });
      save('react', taskId);
    },
    async requestLook(taskId) {
      const t = store.tasks.find((x) => x.id === taskId && x.status === 'done' && x.user_id !== ME) ?? fail('not_found');
      if (!store.looks.some((l) => l.task_id === t.id && l.from_user === ME)) {
        store.looks.push({ task_id: t.id, from_user: ME, seen: false, created_at: new Date().toISOString() });
      }
      save('look', taskId);
    },
    async markLooksSeen() {
      const mine = new Set(store.tasks.filter((t) => t.user_id === ME).map((t) => t.id));
      for (const l of store.looks) if (mine.has(l.task_id)) l.seen = true;
      save('look_seen');
    },
    async settle(taskId, note) {
      const t = store.tasks.find((x) => x.id === taskId) ?? fail('not_found');
      if (effStatus(t, s(), Date.now()) !== 'failed') fail('not_found');
      if (!store.settlements.some((x) => x.task_id === taskId)) {
        store.settlements.push({ task_id: taskId, settled_by: ME, note: note.slice(0, 200), settled_at: new Date().toISOString() });
      }
      save('settle', taskId);
    },
    async updateMyProfile(p) {
      const me = store.profiles.find((x) => x.id === ME)!;
      Object.assign(me, { ...p, display_name: p.display_name.trim().slice(0, 40) || me.display_name });
      save('profile');
    },
    async adminSetProfile(id, role, active) {
      if (id === ME && (role !== 'admin' || !active)) fail('not_self');
      const p = store.profiles.find((x) => x.id === id);
      if (p) Object.assign(p, { role, active });
      save('profile');
    },
    async updateSettings(n) { store.settings = { ...n }; save('settings'); },
    async listInvites() { return [...store.invites]; },
    async addInvite(email, isAdmin) {
      email = email.trim().toLowerCase();
      if (!email.includes('@')) fail('bad_email');
      store.invites = [...store.invites.filter((i) => i.email !== email), { email, is_admin: isAdmin }].sort((a, b) => a.email.localeCompare(b.email));
      save('invite');
    },
    async removeInvite(email) { store.invites = store.invites.filter((i) => i.email !== email); save('invite'); },
    async addHoliday(day, name) { store.holidays = [...store.holidays.filter((h) => h.day !== day), { day, name }].sort((a, b) => a.day.localeCompare(b.day)); save('holiday'); },
    async removeHoliday(day) { store.holidays = store.holidays.filter((h) => h.day !== day); save('holiday'); },
    async addAdjustment(userId, day, points, reason) {
      if (!reason.trim()) fail('bad_reason');
      store.adjustments.unshift({ id: uid(), user_id: userId, day, points, reason: reason.trim(), created_at: new Date().toISOString() });
      save('adjust');
    },
    async removeAdjustment(id) { store.adjustments = store.adjustments.filter((a) => a.id !== id); save('adjust'); },
    async setPrize(weekStart, prize) {
      store.prizes = store.prizes.filter((p) => p.week_start !== weekStart);
      if (prize.trim()) store.prizes.push({ week_start: weekStart, prize: prize.trim() });
      save('prize');
    },
    subscribe(cb) {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY && e.newValue) { store = JSON.parse(e.newValue); cb(); }
      };
      window.addEventListener('storage', onStorage);
      return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
    },
  };
}

export function resetDemo() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
