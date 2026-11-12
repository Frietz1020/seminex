import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseClient, getSupabaseMode } from './supabaseClient';

afterEach(() => vi.unstubAllEnvs());

describe('Supabase configuration', () => {
  it('fails closed when both public settings are missing', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');

    expect(getSupabaseMode()).toBe('misconfigured');
    expect(getSupabaseClient()).toBeNull();
  });

  it('fails closed when only one public setting is present', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');

    expect(getSupabaseMode()).toBe('misconfigured');
    expect(getSupabaseClient()).toBeNull();
  });
});
