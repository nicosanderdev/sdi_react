import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  authenticateUser,
  createUnauthorizedResponse,
} from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing server environment variables' }, 500);
  }

  try {
    const body = (await req.json()) as { code?: string };
    const code = body.code?.trim();
    if (!code) {
      return jsonResponse({ error: 'Verification code is required' }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: verifyPayload, error: verifyError } = await supabaseAdmin.rpc('verify_member_otp', {
      p_user_id: authResult.user.id,
      p_otp_code: code,
      p_purpose: 'member_phone',
    });

    if (verifyError) {
      console.error('verify-phone-code rpc failed:', verifyError);
      return jsonResponse({ error: 'OTP verification failed' }, 500);
    }

    const payload = verifyPayload as {
      success?: boolean;
      error?: string;
      attempts_left?: number;
      phone?: string;
      phone_prefix?: string;
    } | null;

    if (!payload?.success) {
      return jsonResponse({
        error: payload?.error ?? 'Invalid or expired verification code',
        attemptsLeft: payload?.attempts_left ?? 0,
      }, 400);
    }

    return jsonResponse({
      message: 'Phone number updated successfully',
      newPhone: payload.phone ?? '',
      phonePrefix: payload.phone_prefix ?? '',
    });
  } catch (error) {
    console.error('Error in verify-phone-code:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
