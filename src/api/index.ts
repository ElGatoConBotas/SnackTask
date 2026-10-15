import type { Api } from './types';
import { supabaseApi } from './supabaseApi';
import { demoApi } from './demoApi';

/**
 * Cleans up common copy-paste mistakes in the Supabase address, e.g.
 * "https://abc.supabase.co/rest/v1/", a dashboard link
 * "https://supabase.com/dashboard/project/abc", quotes or spaces.
 */
function cleanUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let u = raw.trim().replace(/^["']|["']$/g, '').trim();
  const dash = u.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dash) return `https://${dash[1]}.supabase.co`;
  if (!/^https?:\/\//.test(u)) u = 'https://' + u;
  try {
    const parsed = new URL(u);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return u;
  }
}

const url = cleanUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim().replace(/^["']|["']$/g, '').trim();

// With Supabase keys the app uses the real shared database; without them it runs as a local demo.
export const api: Api = url && key ? supabaseApi(url, key) : demoApi();
