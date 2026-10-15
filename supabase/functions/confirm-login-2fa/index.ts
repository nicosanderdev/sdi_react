import {
  authenticateUser,
  createUnauthorizedResponse,
} from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/login2fa.ts';

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

  const authResult = await authenticateUser(req);
  if (authResult.error || !authResult.user) {
    return createUnauthorizedResponse(authResult.error ?? 'Authentication failed');
  }

  try {
    const body = (await req.json()) as {
      challengeId?: string;
      code?: string;
      enabled?: boolean;
    };
    const challengeId = (body.challengeId ?? '').trim();
    const code = (body.code ?? '').trim();
    const enabled = body.enabled;

    if (!challengeId || !code || typeof enabled !== 'boolean') {
      return jsonResponse({
        error: 'challengeId, code, and enabled are required',
      }, 400);
    }

    const supabaseAdmin = createServiceClient();

    const { data: otpRow, error: otpLookupError } = await supabaseAdmin
      .from('otp_requests')
      .select('id, user_id, purpose')
      .eq('id', challengeId)
      .eq('purpose', 'login_2fa')
      .maybeSingle();

    if (otpLookupError || !otpRow) {
      return jsonResponse({ error: 'OTP request not found' }, 404);
    }

    if (otpRow.user_id !== authResult.user.id) {
      return jsonResponse({ error: 'OTP request not found' }, 404);
    }

    const { data: verifyPayload, error: verifyError } = await supabaseAdmin.rpc(
      'verify_login_2fa_otp',
      {
        p_otp_request_id: challengeId,
        p_otp_code: code,
      }
    );

    if (verifyError) {
      console.error('confirm-login-2fa rpc failed:', verifyError);
      return jsonResponse({ error: 'OTP verification failed' }, 500);
    }

    const payload = verifyPayload as {
      success?: boolean;
      error?: string;
      attempts_left?: number;
    } | null;

    if (!payload?.success) {
      return jsonResponse({
        error: payload?.error ?? 'Invalid or expired verification code',
        attemptsLeft: payload?.attempts_left ?? 0,
      }, 400);
    }

    const { error: updateError } = await supabaseAdmin
      .from('Members')
      .update({
        twofactorenabled: enabled,
        LastModified: new Date().toISOString(),
        LastModifiedBy: authResult.user.id,
      })
      .eq('UserId', authResult.user.id)
      .eq('IsDeleted', false);

    if (updateError) {
      console.error('confirm-login-2fa update failed:', updateError);
      return jsonResponse({ error: 'Could not update two-factor setting' }, 500);
    }

    return jsonResponse({
      message: enabled
        ? 'Two-factor authentication enabled'
        : 'Two-factor authentication disabled',
      twoFactorEnabled: enabled,
    });
  } catch (error) {
    console.error('Error in confirm-login-2fa:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
