/**
 * Admin Mercado Pago actions: send/resend OAuth invite via WhatsApp, unlink.
 *
 * POST body:
 *   { action: 'send_link' | 'unlink', memberId: string }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  authenticateUser,
  isAdmin,
  createUnauthorizedResponse,
  createForbiddenResponse,
} from '../_shared/auth.ts';
import { sendWhatsappTemplateViaMeta } from '../_shared/whatsapp.ts';
import {
  buildConnectLink,
  normalizeMemberPhone,
  randomToken,
  sha256Hex,
} from '../_shared/mercadoPago.ts';

const LINK_TTL_MINUTES = 10;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  const authResult = await authenticateUser(req);
  if (authResult.error || !authResult.user) {
    return createUnauthorizedResponse(authResult.error ?? 'Authentication failed');
  }
  if (!isAdmin(authResult.user)) {
    return createForbiddenResponse('Admin only');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: 'Missing server environment variables' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = (await req.json()) as { action?: string; memberId?: string };
    const action = body.action?.trim();
    const memberId = body.memberId?.trim();
    if (!action || !memberId) {
      return json({ success: false, error: 'action and memberId are required' }, 400);
    }

    const { data: adminMember, error: adminError } = await supabase
      .from('Members')
      .select('Id')
      .eq('UserId', authResult.user.id)
      .eq('IsDeleted', false)
      .maybeSingle();

    if (adminError || !adminMember) {
      return json({ success: false, error: 'Admin member not found' }, 403);
    }

    const { data: member, error: memberError } = await supabase
      .from('Members')
      .select('Id, FirstName, LastName, Phone, PhonePrefix, IsDeleted')
      .eq('Id', memberId)
      .maybeSingle();

    if (memberError || !member || member.IsDeleted) {
      return json({ success: false, error: 'Member not found' }, 404);
    }

    if (action === 'send_link') {
      const { data: existingAccount } = await supabase
        .from('mercado_pago_accounts')
        .select('id')
        .eq('member_id', memberId)
        .maybeSingle();

      if (existingAccount) {
        return json({
          success: false,
          error: 'Member already connected to Mercado Pago',
          error_code: 'ALREADY_CONNECTED',
        }, 409);
      }

      const phone = normalizeMemberPhone(member.Phone, member.PhonePrefix);
      if (!phone) {
        return json({
          success: false,
          error: 'Member needs a valid phone number (E.164) to receive the WhatsApp invite',
          error_code: 'MISSING_PHONE',
        }, 400);
      }

      await supabase
        .from('mercado_pago_link_requests')
        .update({ revoked_at: new Date().toISOString() })
        .eq('member_id', memberId)
        .is('used_at', null)
        .is('revoked_at', null);

      const rawToken = randomToken(32);
      const tokenHash = await sha256Hex(rawToken);
      const expiresAt = new Date(Date.now() + LINK_TTL_MINUTES * 60 * 1000).toISOString();
      const connectLink = buildConnectLink(rawToken);
      const firstName = (member.FirstName || 'usuario').trim() || 'usuario';

      const { data: linkRow, error: insertError } = await supabase
        .from('mercado_pago_link_requests')
        .insert({
          member_id: memberId,
          token_hash: tokenHash,
          expires_at: expiresAt,
          requested_by_member_id: adminMember.Id,
          whatsapp_status: 'pending',
        })
        .select('id')
        .single();

      if (insertError || !linkRow) {
        console.error('Failed to create link request', insertError);
        return json({ success: false, error: 'Failed to create link request' }, 500);
      }

      const wa = await sendWhatsappTemplateViaMeta(phone, {
        name: 'link_mercado_pago',
        languageCode: 'es',
        bodyParameters: [firstName, connectLink],
      });

      await supabase
        .from('mercado_pago_link_requests')
        .update({
          whatsapp_message_id: wa.messageId ?? null,
          whatsapp_status: wa.ok ? (wa.mode === 'dry-run' ? 'dry-run' : 'sent') : 'failed',
        })
        .eq('id', linkRow.id);

      if (!wa.ok) {
        return json({
          success: false,
          error: wa.error || 'Failed to send WhatsApp template',
          error_code: 'WHATSAPP_SEND_FAILED',
          linkRequestId: linkRow.id,
        }, 502);
      }

      return json({
        success: true,
        message: 'Mercado Pago invite sent',
        linkRequestId: linkRow.id,
        expiresAt,
        mercadoPagoStatus: 'invite_sent',
        whatsappMode: wa.mode ?? 'live',
      });
    }

    if (action === 'unlink') {
      const { error: deleteAccountError } = await supabase
        .from('mercado_pago_accounts')
        .delete()
        .eq('member_id', memberId);

      if (deleteAccountError) {
        console.error('Failed to delete MP account', deleteAccountError);
        return json({ success: false, error: 'Failed to unlink Mercado Pago account' }, 500);
      }

      await supabase
        .from('mercado_pago_link_requests')
        .update({
          revoked_at: new Date().toISOString(),
          pkce_verifier_encrypted: null,
          oauth_state_hash: null,
        })
        .eq('member_id', memberId)
        .is('used_at', null)
        .is('revoked_at', null);

      // Hard-erase leftover encrypted verifiers / hashes for privacy.
      await supabase
        .from('mercado_pago_link_requests')
        .update({
          pkce_verifier_encrypted: null,
          oauth_state_hash: null,
        })
        .eq('member_id', memberId);

      return json({
        success: true,
        message: 'Mercado Pago credentials removed from our database',
        mercadoPagoStatus: 'not_connected',
        note: 'Mercado Pago has no marketplace revoke API; the seller can also revoke the app from their Mercado Pago account settings.',
      });
    }

    return json({ success: false, error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('mercado-pago-admin error', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
});
