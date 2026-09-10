/**
 * Mercado Pago webhook receiver.
 * Verifies x-signature, fetches payment, updates PaymentStatus, then may auto-confirm
 * when the property seller is linked to Mercado Pago.
 */
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  allowUnsignedMercadoPagoWebhooks,
  decryptSecret,
  encryptSecret,
  logAndPublicError,
  mpApiRequest,
  parseMpExternalReference,
  redactSensitive,
  refreshSellerAccessToken,
  resolveWebhookDataId,
  verifyWebhookSignature,
} from '../_shared/mercadoPago.ts';

const WEBHOOK_TS_MAX_AGE_MS = 10 * 60 * 1000;
const HANDLED_OK_RESULTS = new Set([
  'approved',
  'already_approved',
  'pending',
  'rejected',
  'cancelled',
  'refunded',
  'charged_back',
  'unlinked',
  'duplicate',
  'ignored',
  'mp_connect_ignored',
  'mp_connect_noop',
  'merchant_order_no_payments',
]);

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

interface MpMerchantOrder {
  id?: number | string;
  collector?: { id?: number | string };
  payments?: Array<{ id?: string | number }>;
}

interface MpChargeback {
  id?: number | string;
  payment_id?: string | number;
  payments?: Array<{ id?: string | number }>;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function retryable(result: string): boolean {
  return !HANDLED_OK_RESULTS.has(result);
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

async function lookupMemberFromPayment(
  supabase: SupabaseClient,
  payment: MpPayment,
  preferredMemberId?: string,
): Promise<{ memberId: string; mpUserId: string } | null> {
  if (preferredMemberId) {
    const seller = await getSellerAccessToken(supabase, preferredMemberId);
    if (seller) {
      return { memberId: preferredMemberId, mpUserId: seller.mpUserId };
    }
  }

  const refs = parseMpExternalReference(payment.external_reference);
  if (refs.attemptId) {
    const { data: attempt } = await supabase
      .from('mercado_pago_payment_attempts')
      .select('member_id')
      .eq('id', refs.attemptId)
      .maybeSingle();
    if (attempt?.member_id) {
      const seller = await getSellerAccessToken(supabase, attempt.member_id);
      return {
        memberId: attempt.member_id,
        mpUserId: seller?.mpUserId ?? String(payment.collector_id ?? ''),
      };
    }
  }

  if (payment.collector_id != null) {
    const { data: account } = await supabase
      .from('mercado_pago_accounts')
      .select('member_id, mp_user_id')
      .eq('mp_user_id', String(payment.collector_id))
      .maybeSingle();
    if (account) {
      return { memberId: account.member_id, mpUserId: account.mp_user_id };
    }
  }

  return null;
}

async function getPaymentWithToken(
  paymentId: string,
  accessToken: string,
): Promise<MpPayment | null> {
  try {
    return await mpApiRequest<MpPayment>(`/v1/payments/${paymentId}`, { accessToken });
  } catch (error) {
    console.error('GET /v1/payments failed', error);
    return null;
  }
}

async function fetchPaymentWithSeller(
  supabase: SupabaseClient,
  paymentId: string,
  memberId: string,
): Promise<{ payment: MpPayment; sellerMpUserId: string; memberId: string } | null> {
  const seller = await getSellerAccessToken(supabase, memberId);
  if (!seller) return null;
  const payment = await getPaymentWithToken(paymentId, seller.accessToken);
  if (!payment) return null;
  return { payment, sellerMpUserId: seller.mpUserId, memberId };
}

async function fetchPayment(
  supabase: SupabaseClient,
  paymentId: string,
  preferredMemberId?: string,
  collectorHint?: string,
): Promise<{ payment: MpPayment; sellerMpUserId: string; memberId: string } | null> {
  if (preferredMemberId) {
    const fromSeller = await fetchPaymentWithSeller(supabase, paymentId, preferredMemberId);
    if (fromSeller) return fromSeller;
  }

  const platformToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
  if (platformToken) {
    const payment = await getPaymentWithToken(paymentId, platformToken);
    if (payment) {
      const resolved = await lookupMemberFromPayment(supabase, payment, preferredMemberId);
      return {
        payment,
        sellerMpUserId: resolved?.mpUserId ?? String(payment.collector_id ?? ''),
        memberId: resolved?.memberId ?? preferredMemberId ?? '',
      };
    }
  }

  const collectorId = collectorHint?.trim();
  if (collectorId) {
    const { data: account } = await supabase
      .from('mercado_pago_accounts')
      .select('member_id')
      .eq('mp_user_id', collectorId)
      .maybeSingle();
    if (account?.member_id && account.member_id !== preferredMemberId) {
      const fromCollector = await fetchPaymentWithSeller(
        supabase,
        paymentId,
        account.member_id,
      );
      if (fromCollector) return fromCollector;
    }
  }

  return null;
}

async function resolveAttempt(
  supabase: SupabaseClient,
  payment: MpPayment,
  attemptByPayment: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  if (attemptByPayment) return attemptByPayment;

  const refs = parseMpExternalReference(payment.external_reference);

  if (refs.attemptId) {
    const { data } = await supabase
      .from('mercado_pago_payment_attempts')
      .select('*')
      .eq('id', refs.attemptId)
      .maybeSingle();
    if (data) return data;
  }

  if (refs.bookingId) {
    const { data } = await supabase
      .from('mercado_pago_payment_attempts')
      .select('*')
      .eq('booking_id', refs.bookingId)
      .in('status', ['created', 'preference_created', 'pending', 'approved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

async function tryHandlePlanPayment(
  supabase: SupabaseClient,
  paymentId: string,
): Promise<{ ok: boolean; result: string } | null> {
  const platformToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
  if (!platformToken) return null;

  const payment = await getPaymentWithToken(paymentId, platformToken);
  if (!payment) return null;

  const refs = parseMpExternalReference(payment.external_reference);
  let attempt: Record<string, unknown> | null = null;

  const { data: byPayment } = await supabase
    .from('plan_checkout_attempts')
    .select('*')
    .eq('mp_payment_id', String(payment.id))
    .maybeSingle();
  if (byPayment) attempt = byPayment as Record<string, unknown>;

  if (!attempt && refs.attemptId) {
    const { data } = await supabase
      .from('plan_checkout_attempts')
      .select('*')
      .eq('id', refs.attemptId)
      .maybeSingle();
    if (data) attempt = data as Record<string, unknown>;
  }

  if (!attempt) return null;

  const providerStatus = payment.status ?? 'unknown';
  const now = new Date().toISOString();

  if (providerStatus === 'approved') {
    const { data: markResult, error: markError } = await supabase.rpc('finalize_plan_checkout', {
      p_attempt_id: attempt.id,
      p_mp_payment_id: String(payment.id),
      p_amount: payment.transaction_amount ?? null,
      p_currency_code: payment.currency_id ?? null,
    });
    if (markError || !markResult?.success) {
      console.error('finalize_plan_checkout failed', markError, redactSensitive(markResult));
      return { ok: false, result: markResult?.error || 'plan_mark_failed' };
    }
    return { ok: true, result: markResult.already_approved ? 'already_approved' : 'approved' };
  }

  const mappedStatus =
    providerStatus === 'pending'
    || providerStatus === 'in_process'
    || providerStatus === 'authorized'
    || providerStatus === 'in_mediation'
      ? 'pending'
      : providerStatus === 'rejected'
        ? 'rejected'
        : providerStatus === 'cancelled'
          ? 'cancelled'
          : 'pending';

  await supabase
    .from('plan_checkout_attempts')
    .update({
      mp_payment_id: String(payment.id),
      status: mappedStatus === 'pending' ? 'pending' : mappedStatus === 'rejected' || mappedStatus === 'cancelled' ? 'failed' : 'pending',
      updated_at: now,
    })
    .eq('id', attempt.id as string);

  return { ok: true, result: mappedStatus };
}

async function handlePaymentNotification(
  supabase: SupabaseClient,
  paymentId: string,
  collectorHint?: string,
): Promise<{ ok: boolean; result: string }> {
  const planOutcome = await tryHandlePlanPayment(supabase, paymentId);
  if (planOutcome) return planOutcome;

  const { data: attemptByPayment } = await supabase
    .from('mercado_pago_payment_attempts')
    .select('*')
    .eq('mp_payment_id', paymentId)
    .maybeSingle();

  const fetched = await fetchPayment(
    supabase,
    paymentId,
    attemptByPayment?.member_id as string | undefined,
    collectorHint,
  );
  if (!fetched) {
    return { ok: false, result: 'payment_not_matched' };
  }

  const attempt = await resolveAttempt(
    supabase,
    fetched.payment,
    attemptByPayment as Record<string, unknown> | null,
  );
  if (!attempt) {
    return { ok: false, result: 'attempt_not_found' };
  }

  return applyPayment(supabase, attempt, fetched.payment, fetched.sellerMpUserId);
}

async function notifyGuestAfterAutoConfirm(
  bookingId: string,
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  try {
    await fetch(`${supabaseUrl}/functions/v1/send-booking-confirmation`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ bookingId }),
    });
  } catch (error) {
    console.error('auto-confirm guest notification failed', error);
  }
}

async function applyPayment(
  supabase: SupabaseClient,
  attempt: Record<string, unknown>,
  payment: MpPayment,
  sellerMpUserId: string,
): Promise<{ ok: boolean; result: string }> {
  const refs = parseMpExternalReference(payment.external_reference);
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
  const rpcArgs = {
    p_booking_id: attempt.booking_id,
    p_attempt_id: attempt.id,
    p_mp_payment_id: String(payment.id),
    p_provider_status: providerStatus,
    p_provider_status_detail: payment.status_detail ?? null,
    p_payer_email: payment.payer?.email ?? null,
    p_amount: payment.transaction_amount ?? null,
    p_currency_code: payment.currency_id ?? null,
  };

  if (providerStatus === 'approved') {
    const { data: markResult, error: markError } = await supabase.rpc(
      'mark_booking_mercado_pago_approved',
      rpcArgs,
    );

    if (markError || !markResult?.success) {
      console.error('mark_booking_mercado_pago_approved failed', markError, redactSensitive(markResult));
      return { ok: false, result: markResult?.error_code || markResult?.error || 'mark_failed' };
    }

    const { data: autoResult, error: autoError } = await supabase.rpc(
      'try_auto_confirm_paid_booking',
      { p_booking_id: attempt.booking_id },
    );
    if (autoError) {
      console.error('try_auto_confirm_paid_booking failed', autoError);
    } else if (autoResult?.confirmed) {
      await notifyGuestAfterAutoConfirm(String(attempt.booking_id));
    }

    return { ok: true, result: markResult.already_approved ? 'already_approved' : 'approved' };
  }

  if (providerStatus === 'refunded' || providerStatus === 'charged_back') {
    const { data: clearResult, error: clearError } = await supabase.rpc(
      'clear_booking_mercado_pago_approval',
      rpcArgs,
    );

    if (clearError || !clearResult?.success) {
      console.error('clear_booking_mercado_pago_approval failed', clearError, redactSensitive(clearResult));
      return { ok: false, result: clearResult?.error_code || clearResult?.error || 'clear_failed' };
    }
    return { ok: true, result: providerStatus };
  }

  const mappedStatus =
    providerStatus === 'pending'
    || providerStatus === 'in_process'
    || providerStatus === 'authorized'
    || providerStatus === 'in_mediation'
      ? 'pending'
      : providerStatus === 'rejected'
        ? 'rejected'
        : providerStatus === 'cancelled'
          ? 'cancelled'
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

  if (
    action.includes('unlink')
    || action.includes('revoke')
    || action.includes('remove')
    || action === 'application_deauthorized'
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

async function platformAccessToken(): Promise<string | null> {
  return Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN') ?? null;
}

async function handleMerchantOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ ok: boolean; result: string }> {
  const token = await platformAccessToken();
  if (!token) {
    return { ok: false, result: 'payment_not_matched' };
  }

  let order: MpMerchantOrder;
  try {
    order = await mpApiRequest<MpMerchantOrder>(`/merchant_orders/${orderId}`, {
      accessToken: token,
    });
  } catch (error) {
    console.error('GET /merchant_orders failed', error);
    return { ok: false, result: 'payment_not_matched' };
  }

  const payments = order.payments ?? [];
  if (!payments.length) {
    return { ok: true, result: 'merchant_order_no_payments' };
  }

  const collectorHint = order.collector?.id != null ? String(order.collector.id) : undefined;
  let last: { ok: boolean; result: string } = { ok: true, result: 'merchant_order_no_payments' };
  for (const p of payments) {
    if (p.id == null) continue;
    last = await handlePaymentNotification(supabase, String(p.id), collectorHint);
    if (!last.ok) return last;
  }
  return last;
}

async function handleChargeback(
  supabase: SupabaseClient,
  chargebackId: string,
): Promise<{ ok: boolean; result: string }> {
  const token = await platformAccessToken();
  if (!token) {
    return { ok: false, result: 'payment_not_matched' };
  }

  let chargeback: MpChargeback;
  try {
    chargeback = await mpApiRequest<MpChargeback>(`/v1/chargebacks/${chargebackId}`, {
      accessToken: token,
    });
  } catch (error) {
    console.error('GET /v1/chargebacks failed', error);
    return { ok: false, result: 'payment_not_matched' };
  }

  const paymentIds: string[] = [];
  if (chargeback.payment_id != null) paymentIds.push(String(chargeback.payment_id));
  for (const p of chargeback.payments ?? []) {
    if (p.id != null) paymentIds.push(String(p.id));
  }

  if (!paymentIds.length) {
    return { ok: false, result: 'attempt_not_found' };
  }

  let last: { ok: boolean; result: string } = { ok: false, result: 'attempt_not_found' };
  for (const id of paymentIds) {
    last = await handlePaymentNotification(supabase, id);
    if (!last.ok) return last;
  }
  return last;
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
    const url = new URL(req.url);
    const dataId = resolveWebhookDataId(url, payload);
    const topic = String(payload.type ?? payload.topic ?? payload.action ?? 'unknown');

    const signatureOk = await verifyWebhookSignature({
      xSignature,
      xRequestId,
      dataId: dataId || null,
      nowMs: Date.now(),
      maxAgeMs: WEBHOOK_TS_MAX_AGE_MS,
    });

    if (!signatureOk && !allowUnsignedMercadoPagoWebhooks()) {
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

    if (existingEvent?.processing_result && HANDLED_OK_RESULTS.has(existingEvent.processing_result)) {
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
        outcome = { ok: false, result: 'missing_payment_id' };
      } else {
        outcome = await handlePaymentNotification(
          supabase,
          dataId,
          payload.user_id != null ? String(payload.user_id) : undefined,
        );
      }
    } else if (topic.includes('mp-connect') || topic.includes('mp_connect') || topic === 'mp-connect') {
      outcome = await handleMpConnect(supabase, payload);
    } else if (topic.includes('merchant_order')) {
      if (!dataId) {
        outcome = { ok: false, result: 'missing_payment_id' };
      } else {
        outcome = await handleMerchantOrder(supabase, dataId);
      }
    } else if (topic.includes('chargeback')) {
      if (!dataId) {
        outcome = { ok: false, result: 'missing_payment_id' };
      } else {
        outcome = await handleChargeback(supabase, dataId);
      }
    }

    await supabase
      .from('mercado_pago_webhook_events')
      .update({
        processed_at: new Date().toISOString(),
        processing_result: outcome.result,
      })
      .eq('provider_event_id', providerEventId);

    const status = !outcome.ok || retryable(outcome.result) ? 500 : 200;
    return json({ success: outcome.ok, result: outcome.result }, status);
  } catch (error) {
    return json(logAndPublicError(error), 500);
  }
});
