import {
  authenticateUser,
  createUnauthorizedResponse,
} from '../_shared/auth.ts';
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

  const authResult = await authenticateUser(req);
  if (authResult.error || !authResult.user) {
    return createUnauthorizedResponse(authResult.error ?? 'Authentication failed');
  }

  try {
    const supabaseAdmin = createServiceClient();
    const member = await getMemberForUser(supabaseAdmin, authResult.user.id);

    if (!member) {
      return jsonResponse({ error: 'Member profile not found' }, 404);
    }

    const sendResult = await sendLogin2faOtp({
      supabaseAdmin,
      userId: authResult.user.id,
      member,
      req,
      requirePhoneVerified: true,
    });

    if (!sendResult.ok || !sendResult.challengeId) {
      return jsonResponse(
        { error: sendResult.error ?? 'Could not send verification code' },
        sendResult.status ?? 500
      );
    }

    return jsonResponse({
      message: 'Verification code sent successfully',
      challengeId: sendResult.challengeId,
      mode: sendResult.mode,
    });
  } catch (error) {
    console.error('Error in send-login-2fa:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
