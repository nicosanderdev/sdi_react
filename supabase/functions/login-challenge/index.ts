import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  createServiceClient,
  getMemberForUser,
  sendLogin2faOtp,
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ error: 'Missing server environment variables' }, 500);
  }

  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = (body.email ?? '').trim().toLowerCase();
    const password = body.password ?? '';

    if (!email || !password) {
      return jsonResponse({ error: 'Email and password are required' }, 400);
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.user || !signInData.session) {
      return jsonResponse({
        succeeded: false,
        requires2FA: false,
        errorMessage: signInError?.message ?? 'Invalid credentials',
      }, 401);
    }

    const userId = signInData.user.id;
    const supabaseAdmin = createServiceClient();
    const member = await getMemberForUser(supabaseAdmin, userId);

    if (!member) {
      await supabaseAdmin.auth.admin.signOut(signInData.session.access_token);
      return jsonResponse({
        succeeded: false,
        requires2FA: false,
        errorMessage: 'Member profile not found',
      }, 403);
    }

    const twoFactorEnabled = Boolean(member.twofactorenabled);

    if (!twoFactorEnabled) {
      return jsonResponse({
        succeeded: true,
        requires2FA: false,
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        errorMessage: null,
      });
    }

    // Discard the password session before the WhatsApp code is accepted.
    await supabaseAdmin.auth.admin.signOut(signInData.session.access_token);

    const sendResult = await sendLogin2faOtp({
      supabaseAdmin,
      userId,
      member,
      req,
      requirePhoneVerified: true,
    });

    if (!sendResult.ok || !sendResult.challengeId) {
      return jsonResponse({
        succeeded: false,
        requires2FA: false,
        errorMessage: sendResult.error ?? 'Could not send verification code',
      }, sendResult.status ?? 500);
    }

    return jsonResponse({
      succeeded: false,
      requires2FA: true,
      challengeId: sendResult.challengeId,
      errorMessage: null,
      mode: sendResult.mode,
    });
  } catch (error) {
    console.error('Error in login-challenge:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
