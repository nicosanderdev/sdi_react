import { corsHeaders } from '../_shared/cors.ts';
import {
  createServiceClient,
  getMemberForUser,
  mintSessionForUser,
} from '../_shared/login2fa.ts';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = (await req.json()) as { challengeId?: string; code?: string };
    const challengeId = (body.challengeId ?? '').trim();
    const code = (body.code ?? '').trim();

    if (!challengeId || !code) {
      return jsonResponse({
        succeeded: false,
        errorMessage: 'Challenge and verification code are required',
      }, 400);
    }

    const supabaseAdmin = createServiceClient();

    const { data: verifyPayload, error: verifyError } = await supabaseAdmin.rpc(
      'verify_login_2fa_otp',
      {
        p_otp_request_id: challengeId,
        p_otp_code: code,
      }
    );

    if (verifyError) {
      console.error('login-verify-2fa rpc failed:', verifyError);
      return jsonResponse({
        succeeded: false,
        errorMessage: 'OTP verification failed',
      }, 500);
    }

    const payload = verifyPayload as {
      success?: boolean;
      error?: string;
      attempts_left?: number;
      user_id?: string;
    } | null;

    if (!payload?.success || !payload.user_id) {
      return jsonResponse({
        succeeded: false,
        errorMessage: payload?.error ?? 'Invalid or expired verification code',
        attemptsLeft: payload?.attempts_left ?? 0,
      }, 400);
    }

    const member = await getMemberForUser(supabaseAdmin, payload.user_id);
    if (!member?.twofactorenabled) {
      return jsonResponse({
        succeeded: false,
        errorMessage: 'Two-factor authentication is not enabled for this account',
      }, 403);
    }

    const email =
      member.Email?.trim()
      || (await supabaseAdmin.auth.admin.getUserById(payload.user_id)).data.user?.email
      || '';

    if (!email) {
      return jsonResponse({
        succeeded: false,
        errorMessage: 'Could not resolve account email',
      }, 500);
    }

    const session = await mintSessionForUser(supabaseAdmin, payload.user_id, email);
    if ('error' in session) {
      return jsonResponse({
        succeeded: false,
        errorMessage: session.error,
      }, 500);
    }

    return jsonResponse({
      succeeded: true,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      errorMessage: null,
    });
  } catch (error) {
    console.error('Error in login-verify-2fa:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
