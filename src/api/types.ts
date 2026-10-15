export type Color = 'sage' | 'peach' | 'lavender' | 'sky' | 'butter' | 'coral';
export const COLORS: Color[] = ['sage', 'peach', 'lavender', 'sky', 'butter', 'coral'];

export type Emoji = 'clap' | 'fire' | 'muscle' | 'rocket' | 'laugh' | 'donut';
export const EMOJIS: { key: Emoji; char: string }[] = [
  { key: 'clap', char: '👏' },
  { key: 'fire', char: '🔥' },
  { key: 'muscle', char: '💪' },
  { key: 'rocket', char: '🚀' },
  { key: 'laugh', char: '😂' },
  { key: 'donut', char: '🍩' },
];

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_color: Color;
  avatar_emoji: string;
  role: 'member' | 'admin';
  language: 'sl' | 'en';
  theme: 'light' | 'dark';
  active: boolean;
}

export interface Settings {
  max_tasks: number;
  min_estimate: number;
  max_estimate: number;
  lock_time: string; // "10:00:00"
  close_time: string; // "17:00:00"
  points_done: number;
  points_on_time_bonus: number;
  points_failed: number;
  stake_presets: string[];
}

export type Status = 'planned' | 'running' | 'paused' | 'done';
export type EffStatus = Status | 'failed';

export interface RawTask {
  id: string;
  user_id: string;
  task_date: string;
  title: string;
  estimate_min: number;
  stake: string;
  is_private: boolean;
  status: Status;
  started_at: string | null;
  elapsed_sec: number;
  used_timer: boolean;
  on_time: boolean;
  finished_at: string | null;
  created_at: string;
}

export interface BoardTask extends Omit<RawTask, 'title' | 'stake'> {
  title: string | null;
  stake: string | null;
  eff_status: EffStatus;
  points: number;
}

export interface DayResult {
  user_id: string;
  task_date: string;
  planned: number;
  done: number;
  failed: number;
  on_time: number;
  points: number;
  timed_sec: number;
  timed_est_sec: number;
  last_done_at: string | null;
}

export interface Reaction { task_id: string; user_id: string; emoji: Emoji }
export interface LookRequest { task_id: string; from_user: string; seen: boolean; created_at: string }
export interface LedgerRow {
  task_id: string;
  user_id: string;
  task_date: string;
  title: string | null;
  is_private: boolean;
  stake: string | null;
  settled_by: string | null;
  note: string | null;
  settled_at: string | null;
}
export interface Holiday { day: string; name: string }
export interface Adjustment { id: string; user_id: string; day: string; points: number; reason: string; created_at: string }
export interface WeekPrize { week_start: string; prize: string }
export interface Invite { email: string; is_admin: boolean }
export interface AwayDay { user_id: string; day: string }
export interface Activity { id: number; kind: string; user_id: string | null; task_id: string | null; on_time: boolean | null; created_at: string }

export interface Snapshot {
  settings: Settings;
  profiles: Profile[];
  today: BoardTask[];
  myTasks: BoardTask[]; // my own tasks referenced by recent "let me see" requests
  reactions: Reaction[];
  looks: LookRequest[];
  days: DayResult[];
  adjustments: Adjustment[];
  ledger: LedgerRow[];
  away: AwayDay[];
  holidays: Holiday[];
  prizes: WeekPrize[];
  reactionsGiven: { user_id: string; n: number }[];
  activity: Activity[];
}

export interface TaskInput { title: string; estimate: number; stake: string; isPrivate: boolean }

export interface Api {
  demo: boolean;
  getUserId(): Promise<string | null>;
  onAuthChange(cb: () => void): () => void;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
  ensureProfile(): Promise<Profile | null>;
  serverNow(): Promise<number>;
  loadAll(today: string): Promise<Snapshot>;
  tasksInRange(from: string, to: string): Promise<BoardTask[]>;
  addTask(t: TaskInput): Promise<void>;
  editTask(id: string, t: TaskInput): Promise<void>;
  deleteTask(id: string): Promise<void>;
  startTask(id: string): Promise<void>;
  pauseTask(id: string): Promise<void>;
  finishTask(id: string): Promise<boolean>;
  setAway(on: boolean): Promise<void>;
  toggleReaction(taskId: string, emoji: Emoji): Promise<void>;
  requestLook(taskId: string): Promise<void>;
  markLooksSeen(): Promise<void>;
  settle(taskId: string, note: string): Promise<void>;
  updateMyProfile(p: Pick<Profile, 'display_name' | 'avatar_color' | 'avatar_emoji' | 'language' | 'theme'>): Promise<void>;
  adminSetProfile(id: string, role: 'member' | 'admin', active: boolean): Promise<void>;
  updateSettings(s: Settings): Promise<void>;
  listInvites(): Promise<Invite[]>;
  addInvite(email: string, isAdmin: boolean): Promise<void>;
  removeInvite(email: string): Promise<void>;
  addHoliday(day: string, name: string): Promise<void>;
  removeHoliday(day: string): Promise<void>;
  addAdjustment(userId: string, day: string, points: number, reason: string): Promise<void>;
  removeAdjustment(id: string): Promise<void>;
  setPrize(weekStart: string, prize: string): Promise<void>;
  subscribe(cb: () => void): () => void;
}
