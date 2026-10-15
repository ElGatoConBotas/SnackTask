import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Api, BoardTask, Snapshot, TaskInput } from './types';
import { addDays } from '../lib/time';

/** Turns a database error into our short error code (e.g. "locked"). */
export class AppError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) {
    const m = res.error.message || 'unknown';
    throw new AppError(/^[a-z_]+$/.test(m) ? m : m.includes('JWT') ? 'session' : 'unknown');
  }
  return res.data;
}

/** Supabase returns at most 1000 rows per request, so read in pages. */
async function all<T>(make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const res = await make(from, from + size - 1);
    const rows = check(res) ?? [];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

export function supabaseApi(url: string, key: string): Api {
  const sb: SupabaseClient = createClient(url, key, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  const rpc = async <T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> =>
    check(await sb.rpc(fn, args)) as T;

  const taskArgs = (t: TaskInput) => ({ p_title: t.title, p_estimate: t.estimate, p_stake: t.stake, p_private: t.isPrivate });

  return {
    demo: false,

    async getUserId() {
      const { data } = await sb.auth.getSession();
      return data.session?.user.id ?? null;
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange(() => cb());
      return () => data.subscription.unsubscribe();
    },

    async sendCode(email) {
      const redirect = window.location.origin + window.location.pathname;
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: true } });
      if (error) throw new AppError(error.status === 429 ? 'rate_limited' : 'send_failed');
    },

    async verifyCode(email, code) {
      const { error } = await sb.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
      if (error) throw new AppError('bad_code');
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async ensureProfile() {
      const p = await rpc<{ id: string | null } & Record<string, unknown>>('ensure_profile');
      return p && p.id ? (p as never) : null;
    },

    async serverNow() {
      return Number(await rpc<number>('server_now'));
    },

    async loadAll(today) {
      const since = addDays(today, -14);
      const [settings, profiles, todayTasks, looks, days, adjustments, ledger, away, holidays, prizes, reactionsGiven, activity] =
        await Promise.all([
          sb.from('settings').select('*').eq('id', 1).single().then(check),
          sb.from('profiles').select('*').order('display_name').then(check),
          sb.from('board_tasks').select('*').eq('task_date', today).order('created_at').then(check),
          sb.from('look_requests').select('*').gte('created_at', since + 'T00:00:00Z').then(check),
          all((a, b) => sb.from('day_results').select('*').order('task_date').order('user_id').range(a, b)),
          all((a, b) => sb.from('adjustments').select('*').order('created_at', { ascending: false }).range(a, b)),
          all((a, b) => sb.from('ledger').select('*').order('task_date', { ascending: false }).order('task_id').range(a, b)),
          all((a, b) => sb.from('away_days').select('*').order('day').order('user_id').range(a, b)),
          sb.from('holidays').select('*').order('day').then(check),
          sb.from('week_prizes').select('*').order('week_start', { ascending: false }).limit(200).then(check),
          sb.from('reactions_given').select('*').then(check),
          sb.from('activity').select('*').order('id', { ascending: false }).limit(40).then(check),
        ]);
      const todayIds = (todayTasks as BoardTask[]).map((t) => t.id);
      const reactions = todayIds.length ? check(await sb.from('reactions').select('task_id,user_id,emoji').in('task_id', todayIds)) : [];
      const me = (await sb.auth.getSession()).data.session?.user.id;
      const lookTaskIds = [...new Set((looks as { task_id: string }[]).map((l) => l.task_id))];
      const myTasks = lookTaskIds.length && me
        ? check(await sb.from('board_tasks').select('*').eq('user_id', me).in('id', lookTaskIds))
        : [];
      return {
        settings, profiles, today: todayTasks, myTasks, reactions, looks, days, adjustments, ledger, away,
        holidays, prizes, reactionsGiven, activity,
      } as Snapshot;
    },

    async tasksInRange(from, to) {
      return all((a, b) => sb.from('board_tasks').select('*').gte('task_date', from).lte('task_date', to).order('id').range(a, b));
    },

    addTask: async (t) => { await rpc('add_task', taskArgs(t)); },
    editTask: async (id, t) => { await rpc('edit_task', { p_id: id, ...taskArgs(t) }); },
    deleteTask: async (id) => { await rpc('delete_task', { p_id: id }); },
    startTask: async (id) => { await rpc('start_task', { p_id: id }); },
    pauseTask: async (id) => { await rpc('pause_task', { p_id: id }); },
    finishTask: async (id) => Boolean(await rpc('finish_task', { p_id: id })),
    setAway: async (on) => { await rpc('set_away', { p_on: on }); },
    toggleReaction: async (taskId, emoji) => { await rpc('toggle_reaction', { p_task: taskId, p_emoji: emoji }); },
    requestLook: async (taskId) => { await rpc('request_look', { p_task: taskId }); },
    markLooksSeen: async () => { await rpc('mark_looks_seen'); },
    settle: async (taskId, note) => { await rpc('settle', { p_task: taskId, p_note: note }); },
    updateMyProfile: async (p) => {
      await rpc('update_my_profile', { p_name: p.display_name, p_color: p.avatar_color, p_emoji: p.avatar_emoji, p_language: p.language, p_theme: p.theme });
    },
    adminSetProfile: async (id, role, active) => { await rpc('admin_set_profile', { p_user: id, p_role: role, p_active: active }); },

    async updateSettings(s) {
      check(await sb.from('settings').update({ ...s, updated_at: new Date().toISOString() }).eq('id', 1));
    },
    async listInvites() {
      return check(await sb.from('invites').select('email,is_admin').order('email')) ?? [];
    },
    async addInvite(email, isAdmin) {
      check(await sb.from('invites').upsert({ email: email.trim().toLowerCase(), is_admin: isAdmin }));
    },
    async removeInvite(email) {
      check(await sb.from('invites').delete().eq('email', email));
    },
    async addHoliday(day, name) {
      check(await sb.from('holidays').upsert({ day, name }));
    },
    async removeHoliday(day) {
      check(await sb.from('holidays').delete().eq('day', day));
    },
    async addAdjustment(userId, day, points, reason) {
      const me = await this.getUserId();
      check(await sb.from('adjustments').insert({ user_id: userId, day, points, reason, created_by: me }));
    },
    async removeAdjustment(id) {
      check(await sb.from('adjustments').delete().eq('id', id));
    },
    async setPrize(weekStart, prize) {
      if (prize.trim()) check(await sb.from('week_prizes').upsert({ week_start: weekStart, prize: prize.trim() }));
      else check(await sb.from('week_prizes').delete().eq('week_start', weekStart));
    },

    subscribe(cb) {
      const ch = sb.channel('snacktask-live');
      for (const table of ['activity', 'settings', 'profiles', 'holidays', 'adjustments', 'week_prizes']) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => cb());
      }
      ch.subscribe();
      return () => { void sb.removeChannel(ch); };
    },
  };
}
