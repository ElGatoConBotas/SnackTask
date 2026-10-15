import type { Api } from './types';
import { supabaseApi } from './supabaseApi';
import { demoApi } from './demoApi';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// With Supabase keys the app uses the real shared database; without them it runs as a local demo.
export const api: Api = url && key ? supabaseApi(url, key) : demoApi();
