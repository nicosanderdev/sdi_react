/**
 * Public Mercado Pago OAuth connect flow.
 *
 * POST /start  { token }  -> { authorizationUrl }
 * GET  /callback?code=&state=  -> redirect to result page
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  buildAuthorizationUrl,
  buildConnectResultUrl,
  createPkcePair,
  decryptSecret,
  encryptSecret,
  exchangeAuthorizationCode,
  getOAuthStartDiagnostics,
  logAndPublicError,
  randomToken,
  sha256Hex,
} from '../_shared/mercadoPago.ts';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: url },
  });
}

function resolveAction(req: Request): 'start' | 'callback' | 'unknown' {
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1] || '';
  if (req.method === 'POST' && (last === 'start' || last === 'mercado-pago-connect')) {
    return 'start';
  }
  if (req.method === 'GET' && (last === 'callback' || url.searchParams.has('code') || url.searchParams.has('error'))) {
    return 'callback';
  }
  if (req.method === 'GET' && last === 'mercado-pago-connect') {
    return 'callback';
  }
  return 'unknown';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: 'Missing server environment variables' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const action = resolveAction(req);

  try {
    if (action === 'start') {
      const body = (await req.json()) as { token?: string };
      const rawToken = body.token?.trim();
      if (!rawToken) {
        return json({ success: false, error: 'token is required', error_code: 'MISSING_TOKEN' }, 400);
      }

      const tokenHash = await sha256Hex(rawToken);
      const { data: link, error: linkError } = await supabase
        .from('mercado_pago_link_requests')
        .select('id, member_id, expires_at, used_at, revoked_at')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (linkError || !link) {
        return json({ success: false, error: 'Invalid link', error_code: 'INVALID_LINK' }, 404);
      }
      if (link.used_at) {
        return json({ success: false, error: 'Link already used', error_code: 'LINK_USED' }, 410);
      }
      if (link.revoked_at) {
        return json({ success: false, error: 'Link revoked', error_code: 'LINK_REVOKED' }, 410);
      }
      if (new Date(link.expires_at).getTime() <= Date.now()) {
        return json({ success: false, error: 'Link expired', error_code: 'LINK_EXPIRED' }, 410);
      }

      const { data: existingAccount } = await supabase
        .from('mercado_pago_accounts')
        .select('id')
        .eq('member_id', link.member_id)
        .maybeSingle();

      if (existingAccount) {
        return json({
          success: false,
          error: 'Already connected',
          error_code: 'ALREADY_CONNECTED',
        }, 409);
      }

      const oauthStart = getOAuthStartDiagnostics();
      console.info('mercado-pago-connect oauth start', oauthStart);

      const oauthState = randomToken(24);
      const oauthStateHash = await sha256Hex(oauthState);
      const pkce = await createPkcePair();
      const pkceEncrypted = await encryptSecret(pkce.verifier);

      const { error: updateError } = await supabase
        .from('mercado_pago_link_requests')
        .update({
          oauth_state_hash: oauthStateHash,
          pkce_verifier_encrypted: pkceEncrypted,
        })
        .eq('id', link.id)
        .is('used_at', null)
        .is('revoked_at', null);

      if (updateError) {
        console.error('Failed to store PKCE state', updateError);
        return json({ success: false, error: 'Failed to start OAuth' }, 500);
      }

      const authorizationUrl = buildAuthorizationUrl({
        state: oauthState,
        codeChallenge: pkce.challenge,
      });

      return json({ success: true, authorizationUrl });
    }

    if (action === 'callback') {
      const url = new URL(req.url);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const oauthError = url.searchParams.get('error');

      if (oauthError) {
        return redirect(buildConnectResultUrl('error', 'declined'));
      }
      if (!code || !state) {
        return redirect(buildConnectResultUrl('error', 'missing_params'));
      }

      const stateHash = await sha256Hex(state);
      const { data: link, error: linkError } = await supabase
        .from('mercado_pago_link_requests')
        .select('id, member_id, expires_at, used_at, revoked_at, pkce_verifier_encrypted')
        .eq('oauth_state_hash', stateHash)
        .maybeSingle();

      if (linkError || !link || !link.pkce_verifier_encrypted) {
        return redirect(buildConnectResultUrl('error', 'invalid_state'));
      }
      if (link.used_at || link.revoked_at || new Date(link.expires_at).getTime() <= Date.now()) {
        return redirect(buildConnectResultUrl('error', 'link_expired'));
      }

      const codeVerifier = await decryptSecret(link.pkce_verifier_encrypted);
      const useTestToken = Deno.env.get('MERCADO_PAGO_TEST_TOKEN') === 'true';

      const tokens = await exchangeAuthorizationCode({
        code,
        codeVerifier,
        testToken: useTestToken,
      });

      const accessEncrypted = await encryptSecret(tokens.accessToken);
      const refreshEncrypted = tokens.refreshToken
        ? await encryptSecret(tokens.refreshToken)
        : null;

      const { error: upsertError } = await supabase
        .from('mercado_pago_accounts')
        .upsert(
          {
            member_id: link.member_id,
            mp_user_id: tokens.userId,
            access_token_encrypted: accessEncrypted,
            refresh_token_encrypted: refreshEncrypted,
            token_expires_at: new Date(tokens.expiresAt).toISOString(),
            scope: tokens.scope ?? null,
            public_key: tokens.publicKey ?? null,
            live_mode: tokens.liveMode ?? null,
            connected_at: new Date().toISOString(),
            last_refreshed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'member_id' },
        );

      if (upsertError) {
        console.error('Failed to store MP account', upsertError);
        return redirect(buildConnectResultUrl('error', 'store_failed'));
      }

      await supabase
        .from('mercado_pago_link_requests')
        .update({
          used_at: new Date().toISOString(),
          pkce_verifier_encrypted: null,
          oauth_state_hash: null,
        })
        .eq('id', link.id);

      return redirect(buildConnectResultUrl('success'));
    }

    return json({ success: false, error: 'Unknown endpoint' }, 404);
  } catch (error) {
    if (action === 'callback') {
      console.error('mercado-pago-connect error', error);
      return redirect(buildConnectResultUrl('error', 'oauth_failed'));
    }
    return json(logAndPublicError(error), 500);
  }
});
