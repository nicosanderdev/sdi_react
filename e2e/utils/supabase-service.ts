import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client with service role (Playwright / Node only).
 * Never import this module from the Vite app bundle.
 */
export function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!url) {
    throw new Error(
      'E2E: Set SUPABASE_URL or VITE_SUPABASE_URL for Supabase seeding.'
    );
  }
  return url;
}

/** PostgREST expects a JWT (header.payload.sig). New `sb_secret_*` keys are not JWTs → PGRST301. */
function assertServiceRoleKeyIsJwt(serviceRoleKey: string): void {
  const key = serviceRoleKey.trim();
  const parts = key.split('.');
  if (parts.length === 3 && parts.every((p) => p.length > 0)) {
    return;
  }
  throw new Error(
    'E2E: SUPABASE_SERVICE_ROLE_KEY must be the JWT-format service_role key (three segments separated by dots, typically starting with eyJ). ' +
      'In the Supabase Dashboard: Project Settings → API → service_role (under "Project API keys"), not the sb_secret_… / "secret" non-JWT key. ' +
      'Local CLI: run `npx supabase status` and use the JWT value next to service_role. ' +
      'Never commit this key.'
  );
}

export function createSupabaseServiceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'E2E: Set SUPABASE_SERVICE_ROLE_KEY (server-side only). Never commit it or expose it to the browser.'
    );
  }
  assertServiceRoleKeyIsJwt(key);
  return createClient(getSupabaseUrl(), key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
