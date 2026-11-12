import { getSupabaseClient } from './supabaseClient';
import type { ApiResult, ServerTime } from './types';

function failure(): ApiResult<ServerTime> {
  return { ok: false, error: { code: 'network' } };
}

/** Reads the database clock. This adapter deliberately has no local-clock fallback. */
export async function getServerTime(): Promise<ApiResult<ServerTime>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: { code: 'configuration_error' } };
  try {
    const { data, error } = await supabase.rpc('get_server_time');
    if (error || typeof data !== 'string') return failure();
    const timestamp = Date.parse(data);
    if (!Number.isFinite(timestamp)) return failure();
    return { ok: true, data: { now: new Date(timestamp).toISOString() } };
  } catch {
    return failure();
  }
}
