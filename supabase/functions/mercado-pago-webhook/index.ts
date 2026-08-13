/**
 * Mercado Pago webhook receiver.
 * Verifies x-signature, fetches payment with seller token, marks booking audit only.
 */
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  decryptSecret,
  encryptSecret,
  mpApiRequest,
  redactSensitive,
  refreshSellerAccessToken,
  verifyWebhookSignature,
} from '../_shared/mercadoPago.ts';

interface MpPayment {
  id: number | string;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  currency_id?: string;
  external_reference?: string;
  collector_id?: number | string;
  payer?: { email?: string };
  metadata?: Record<string, unknown>;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseExternalReference(ref: string | undefined | null): {
  bookingId: string | null;
  attemptId: string | null;
} {
  if (!ref) return { bookingId: null, attemptId: null };
  const match = /^booking:([0-9a-f-]{36}):attempt:([0-9a-f-]{36})$/i.exec(ref.trim());
  if (!match) return { bookingId: null, attemptId: null };
  return { bookingId: match[1], attemptId: match[2] };
}

async function getSellerAccessToken(
  supabase: SupabaseClient,
  memberId: string,
): Promise<{ accessToken: string; mpUserId: string } | null> {
  const { data: account } = await supabase
    .from('mercado_pago_accounts')
    .select('id, mp_user_id, access_token_encrypted, refresh_token_encrypted, token_expires_at')
    .eq('member_id', memberId)
    .maybeSingle();

  if (!account) return null;

  const expiresAt = account.token_expires_at
    ? new Date(account.token_expires_at).getTime()
    : 0;
  if (expiresAt >= Date.now() + 60_000) {
    return {
      accessToken: await decryptSecret(account.access_token_encrypted),
      mpUserId: account.mp_user_id,
    };
  }

  if (!account.refresh_token_encrypted) {
    return {
      accessToken: await decryptSecret(account.access_token_encrypted),
      mpUserId: account.mp_user_id,
    };
  }

  const refreshed = await refreshSellerAccessToken(
    await decryptSecret(account.refresh_token_encrypted),
  );
  await supabase
    .from('mercado_pago_accounts')
    .update({
      access_token_encrypted: await encryptSecret(refreshed.accessToken),
      refresh_token_encrypted: refreshed.refreshToken
        ? await encryptSecret(refreshed.refreshToken)
        : account.refresh_token_encrypted,
      token_expires_at: new Date(refreshed.expiresAt).toISOString(),
      last_refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id);

  return { accessToken: refreshed.accessToken, mpUserId: account.mp_user_id };
}

async function fetchPayment(
  supabase: SupabaseClient,
  paymentId: string,
  preferredMemberId?: string,
): Promise<{ payment: MpPayment; sellerMpUserId: string; memberId: string } | null> {
  const platformToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
  if (platformToken) {
    try {
      const payment = await mpApiRequest<MpPayment>(`/v1/payments/${paymentId}`, {
        accessToken: platformToken,
      });
      const refs = parseExternalReference(payment.external_reference);
      let memberId = preferredMemberId;
      if (!memberId && refs.attemptId) {
        const { data: attempt } = await supabase
          .from('mercado_pago_payment_attempts')
          .select('member_id')
          .eq('id', refs.attemptId)
          .maybeSingle();
        memberId = attempt?.member_id;
      }
      if (!memberId && payment.collector_id != null) {
        const { data: account } = await supabase
          .from('mercado_pago_accounts')
          .select('member_id, mp_user_id')
          .eq('mp_user_id', String(payment.collector_id))
          .maybeSingle();
        if (account) {
          return {
            payment,
            sellerMpUserId: account.mp_user_id,
            memberId: account.member_id,
          };
        }
      }
      if (memberId) {
        const seller = await getSellerAccessToken(supabase, memberId);
        return {
          payment,
          sellerMpUserId: seller?.mpUserId ?? String(payment.collector_id ?? ''),
          memberId,
        };
      }
    } catch (error) {
      console.error('Platform token payment fetch failed', error);
    }
  }

  const memberIds: string[] = [];
  if (preferredMemberId) memberIds.push(preferredMemberId);

  const { data: candidates } = await supabase
    .from('mercado_pago_payment_attempts')
    .select('member_id')
    .in('status', ['created', 'preference_created', 'pending'])
    .order('created_at', { ascending: false })
    .limit(25);

  for (const row of candidates ?? []) {
    if (!memberIds.includes(row.member_id)) memberIds.push(row.member_id);
  }

  for (const memberId of memberIds) {
    const seller = await getSellerAccessToken(supabase, memberId);
    if (!seller) continue;
    try {
      const payment = await mpApiRequest<MpPayment>(`/v1/payments/${paymentId}`, {
        accessToken: seller.accessToken,
      });
      return { payment, sellerMpUserId: seller.mpUserId, memberId };
    } catch {
      // Try next seller token.
    }
  }

  return null;
}

async function handlePaymentNotification(
  supabase: SupabaseClient,
  paymentId: string,
): Promise<{ ok: boolean; result: string }> {
  const { data: attemptByPayment } = await supabase
    .from('mercado_pago_payment_attempts')
    .select('*')
    .eq('mp_payment_id', paymentId)
    .maybeSingle();

  const fetched = await fetchPayment(
    supabase,
    paymentId,
    attemptByPayment?.member_id as string | undefined,
  );
  if (!fetched) {
    return { ok: true, result: 'payment_not_matched' };
  }

  const refs = parseExternalReference(fetched.payment.external_reference);
  let attempt = attemptByPayment;

  if (!attempt && refs.attemptId) {
    const { data } = await supabase
      .from('mercado_pago_payment_attempts')
      .select('*')
      .eq('id', refs.attemptId)
      .maybeSingle();
    attempt = data;
  }

  if (!attempt && refs.bookingId) {
    const { data } = await supabase
      .from('mercado_pago_payment_attempts')
      .select('*')
      .eq('booking_id', refs.bookingId)
      .in('status', ['created', 'preference_created', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    attempt = data;
  }

  if (!attempt) {
    return { ok: true, result: 'attempt_not_found' };
  }

  return applyPayment(supabase, attempt, fetched.payment, fetched.sellerMpUserId);
}

async function applyPayment(
  supabase: SupabaseClient,
  attempt: Record<string, unknown>,
  payment: MpPayment,
  sellerMpUserId: string,
): Promise<{ ok: boolean; result: string }> {
  const refs = parseExternalReference(payment.external_reference);
  if (refs.attemptId && refs.attemptId !== attempt.id) {
    return { ok: false, result: 'attempt_mismatch' };
  }
  if (refs.bookingId && refs.bookingId !== attempt.booking_id) {
    return { ok: false, result: 'booking_mismatch' };
  }

  if (payment.collector_id != null && String(payment.collector_id) !== String(sellerMpUserId)) {
    return { ok: false, result: 'collector_mismatch' };
  }

  const providerStatus = payment.status ?? 'unknown';
  const now = new Date().toISOString();

  if (providerStatus === 'approved') {
    const { data: markResult, error: markError } = await supabase.rpc(
      'mark_booking_mercado_pago_approved',
      {
        p_booking_id: attempt.booking_id,
        p_attempt_id: attempt.id,
        p_mp_payment_id: String(payment.id),
        p_provider_status: providerStatus,
        p_provider_status_detail: payment.status_detail ?? null,
        p_payer_email: payment.payer?.email ?? null,
        p_amount: payment.transaction_amount ?? null,
        p_currency_code: payment.currency_id ?? null,
      },
    );

    if (markError || !markResult?.success) {
      console.error('mark_booking_mercado_pago_approved failed', markError, redactSensitive(markResult));
      return { ok: false, result: markResult?.error_code || markResult?.error || 'mark_failed' };
    }
    return { ok: true, result: markResult.already_approved ? 'already_approved' : 'approved' };
  }

  const mappedStatus =
    providerStatus === 'pending' || providerStatus === 'in_process'
      ? 'pending'
      : providerStatus === 'rejected'
        ? 'rejected'
        : providerStatus === 'cancelled'
          ? 'cancelled'
          : providerStatus === 'refunded'
            ? 'refunded'
            : providerStatus === 'charged_back'
              ? 'charged_back'
              : 'pending';

  await supabase
    .from('mercado_pago_payment_attempts')
    .update({
      mp_payment_id: String(payment.id),
      status: mappedStatus,
      provider_status: providerStatus,
      provider_status_detail: payment.status_detail ?? null,
      payer_email: payment.payer?.email ?? null,
      updated_at: now,
    })
    .eq('id', attempt.id as string);

  return { ok: true, result: mappedStatus };
}

async function handleMpConnect(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; result: string }> {
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const userId = data.user_id ?? data.id ?? payload.user_id;
  const action = String(data.action ?? payload.action ?? payload.type ?? '').toLowerCase();

  if (!userId) {
    return { ok: true, result: 'mp_connect_ignored' };
  }

  // Unlink / revoke style events erase local credentials.
  if (
    action.includes('unlink') ||
    action.includes('revoke') ||
    action.includes('remove') ||
    action === 'application_deauthorized'
  ) {
    const { error } = await supabase
      .from('mercado_pago_accounts')
      .delete()
      .eq('mp_user_id', String(userId));
    if (error) {
      console.error('mp-connect unlink failed', error);
      return { ok: false, result: 'unlink_failed' };
    }
    return { ok: true, result: 'unlinked' };
  }

  return { ok: true, result: 'mp_connect_noop' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
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
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody || '{}') as Record<string, unknown>;
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');
    const dataObj = (payload.data ?? {}) as Record<string, unknown>;
    const dataId = String(dataObj.id ?? payload.id ?? '');
    const topic = String(payload.type ?? payload.topic ?? payload.action ?? 'unknown');

    const signatureOk = await verifyWebhookSignature({
      xSignature,
      xRequestId,
      dataId: dataId || null,
    });

    // Allow local dry-run / simulator without secret only when explicitly enabled.
    const allowUnsigned = Deno.env.get('MERCADO_PAGO_ALLOW_UNSIGNED_WEBHOOKS') === 'true';
    if (!signatureOk && !allowUnsigned) {
      return json({ success: false, error: 'Invalid signature' }, 401);
    }

    const providerEventId =
      xRequestId ||
      `${topic}:${dataId}:${(payload as { id?: string }).id ?? ''}` ||
      crypto.randomUUID();

    const { data: existingEvent } = await supabase
      .from('mercado_pago_webhook_events')
      .select('id, processing_result')
      .eq('provider_event_id', providerEventId)
      .maybeSingle();

    if (existingEvent?.processing_result) {
      return json({ success: true, result: 'duplicate', previous: existingEvent.processing_result });
    }

    await supabase.from('mercado_pago_webhook_events').upsert(
      {
        provider_event_id: providerEventId,
        topic,
        resource_id: dataId || null,
        request_id: xRequestId,
        payload: redactSensitive(payload) as Record<string, unknown>,
      },
      { onConflict: 'provider_event_id' },
    );

    let outcome = { ok: true, result: 'ignored' };

    if (topic.includes('payment') || topic === 'topic_payment') {
      if (!dataId) {
        outcome = { ok: true, result: 'missing_payment_id' };
      } else {
        outcome = await handlePaymentNotification(supabase, dataId);
      }
    } else if (topic.includes('mp-connect') || topic.includes('mp_connect') || topic === 'mp-connect') {
      outcome = await handleMpConnect(supabase, payload);
    } else if (topic.includes('merchant_order')) {
      // Checkout Pro may notify merchant orders; extract payment ids if present.
      const payments = ((payload as { payments?: Array<{ id?: string | number }> }).payments) ?? [];
      for (const p of payments) {
        if (p.id != null) {
          outcome = await handlePaymentNotification(supabase, String(p.id));
        }
      }
      if (!payments.length) {
        outcome = { ok: true, result: 'merchant_order_no_payments' };
      }
    }

    await supabase
      .from('mercado_pago_webhook_events')
      .update({
        processed_at: new Date().toISOString(),
        processing_result: outcome.result,
      })
      .eq('provider_event_id', providerEventId);

    // Always ack quickly with 200 when signature verified to stop retries for handled noise.
    return json({ success: outcome.ok, result: outcome.result });
  } catch (error) {
    console.error('mercado-pago-webhook error', error);
    // Return 500 so MP retries transient failures.
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
});
