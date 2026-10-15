// All dates and times in the app are Slovenian time (Europe/Ljubljana),
// whatever time zone the viewer's computer is set to.
const TZ = 'Europe/Ljubljana';

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
});

export interface LocalParts { date: string; time: string; seconds: number }

export function lj(ms: number): LocalParts {
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(new Date(ms))) p[part.type] = part.value;
  const date = `${p.year}-${p.month}-${p.day}`;
  const time = `${p.hour}:${p.minute}:${p.second}`;
  return { date, time, seconds: +p.hour * 3600 + +p.minute * 60 + +p.second };
}

export function timeToSec(t: string): number {
  const [h, m, s] = t.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
}

export function hhmm(t: string): string {
  return t.slice(0, 5);
}

function utc(d: string): Date {
  return new Date(d + 'T00:00:00Z');
}

export function addDays(d: string, n: number): string {
  const x = utc(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

/** 1 = Monday ... 7 = Sunday */
export function isoDow(d: string): number {
  const w = utc(d).getUTCDay();
  return w === 0 ? 7 : w;
}

export function weekStart(d: string): string {
  return addDays(d, 1 - isoDow(d));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b).getTime() - utc(a).getTime()) / 86400000);
}

export function fmtDuration(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function fmtCountdown(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${sec} s`;
}

export function fmtDate(d: string, lang: 'sl' | 'en', withWeekday = true): string {
  return new Intl.DateTimeFormat(lang === 'sl' ? 'sl-SI' : 'en-GB', {
    timeZone: 'UTC',
    weekday: withWeekday ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
  }).format(utc(d));
}

export function fmtShortDate(d: string, lang: 'sl' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'sl' ? 'sl-SI' : 'en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(utc(d));
}

export function fmtClock(ms: number): string {
  return lj(ms).time.slice(0, 5);
}
