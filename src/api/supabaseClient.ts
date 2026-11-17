import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseMode = 'supabase' | 'misconfigured';

function publicConfig(): { url: string; key: string } {
  return {
    url: import.meta.env.VITE_SUPABASE_URL?.trim() ?? '',
    key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '',
  };
}

export function getSupabaseMode(): SupabaseMode {
  const { url, key } = publicConfig();
  return url && key ? 'supabase' : 'misconfigured';
}

let client: SupabaseClient | null = null;

/** Creates one browser client from public project values; no privileged key is accepted. */
export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = publicConfig();
  if (getSupabaseMode() !== 'supabase') return null;
  client ??= createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });
  return client;
}

/** Notifies app session state after cross-tab Auth changes and token refreshes. */
export function subscribeAuthState(listener: () => void): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => undefined;
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'INITIAL_SESSION') return;
    window.setTimeout(listener, 0);
  });
  return () => subscription.unsubscribe();
}
