/**
 * Create Mercado Pago Checkout Pro preference for a booking.
 *
 * POST { "manageToken": "<opaque manage token>" }
 *
 * No marketplace_fee (zero-fee marketplace policy).
 */
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getGuestPaymentReturnOrigin } from '../_shared/guestManageUrl.ts';
import {
  currencyCodeFromInt,
  decryptSecret,
  encodeMpExternalReference,
  encryptSecret,
  getPublicAppBaseUrl,
  logAndPublicError,
  mpApiRequest,
  refreshSellerAccessToken,
  sha256Hex,
} from '../_shared/mercadoPago.ts';

const DISCLAIMER_KEY = 'mercado_pago_bridge_disclaimer';

interface PreferenceResponse {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function reusePayload(params: {
  attemptId: string;
  preferenceId: string | null;
  initPoint: string | null;
  sandboxInitPoint: string | null;
  amount: number;
  currencyCode: string;
}) {
  return {
    success: true,
    attemptId: params.attemptId,
    preferenceId: params.preferenceId,
    initPoint: params.initPoint,
    sandboxInitPoint: params.sandboxInitPoint,
    amount: params.amount,
    currencyCode: params.currencyCode,
    reused: true,
    disclaimerKey: DISCLAIMER_KEY,
  };
}

async function resolveBookingId(
  supabase: SupabaseClient,
  manageToken: string | undefined,
): Promise<{ bookingId: string | null; error?: string; status?: number }> {
  if (!manageToken?.trim()) {
    return { bookingId: null, error: 'manageToken is required', status: 400 };
  }

  const tokenHash = await sha256Hex(manageToken.trim());
  const { data, error } = await supabase
    .from('booking_manage_tokens')
    .select('booking_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) {
    return { bookingId: null, error: 'Invalid or expired manage token', status: 401 };
  }
  return { bookingId: data.booking_id };
}

async function getValidSellerAccessToken(
  supabase: SupabaseClient,
  account: {
    id: string;
    access_token_encrypted: string;
    refresh_token_encrypted: string | null;
    token_expires_at: string | null;
    mp_user_id: string;
  },
): Promise<string> {
  const expiresAt = account.token_expires_at
    ? new Date(account.token_expires_at).getTime()
    : 0;
  const needsRefresh = expiresAt < Date.now() + 5 * 60 * 1000;

  if (!needsRefresh) {
    return decryptSecret(account.access_token_encrypted);
  }

  if (!account.refresh_token_encrypted) {
    throw new Error('Seller token expired and no refresh token is available');
  }

  const refreshToken = await decryptSecret(account.refresh_token_encrypted);
  const refreshed = await refreshSellerAccessToken(refreshToken);
  const accessEncrypted = await encryptSecret(refreshed.accessToken);
  const refreshEncrypted = refreshed.refreshToken
    ? await encryptSecret(refreshed.refreshToken)
    : account.refresh_token_encrypted;

  await supabase
    .from('mercado_pago_accounts')
    .update({
      access_token_encrypted: accessEncrypted,
      refresh_token_encrypted: refreshEncrypted,
      token_expires_at: new Date(refreshed.expiresAt).toISOString(),
      scope: refreshed.scope ?? null,
      public_key: refreshed.publicKey ?? null,
      last_refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id);

  return refreshed.accessToken;
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
    const body = (await req.json()) as { manageToken?: string };

    const resolved = await resolveBookingId(supabase, body.manageToken);
    if (!resolved.bookingId) {
      return json({ success: false, error: resolved.error }, resolved.status ?? 400);
    }

    const { data: paymentInfo, error: paymentInfoError } = await supabase.rpc(
      'get_booking_mercado_pago_payment_info',
      { p_booking_id: resolved.bookingId },
    );

    if (paymentInfoError || !paymentInfo?.success) {
      return json({
        success: false,
        error: paymentInfo?.error || paymentInfoError?.message || 'Unable to load payment info',
        error_code: paymentInfo?.error_code,
      }, 400);
    }

    if (!paymentInfo.can_pay_online) {
      return json({
        success: false,
        error: paymentInfo.mercado_pago_approved
          ? 'Booking payment already approved'
          : paymentInfo.seller_error_code === 'SELLER_NOT_CONNECTED'
            ? 'Property owner is not connected to Mercado Pago'
            : 'Online payment is not available for this booking',
        error_code: paymentInfo.mercado_pago_approved
          ? 'ALREADY_APPROVED'
          : paymentInfo.seller_error_code || 'CANNOT_PAY',
      }, 409);
    }

    const amount = Number(paymentInfo.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ success: false, error: 'Invalid booking amount', error_code: 'INVALID_AMOUNT' }, 400);
    }

    const currencyCode = String(paymentInfo.currency_code || currencyCodeFromInt(paymentInfo.currency));
    const sellerMemberId = String(paymentInfo.seller_member_id);

    const { data: account, error: accountError } = await supabase
      .from('mercado_pago_accounts')
      .select('id, member_id, mp_user_id, access_token_encrypted, refresh_token_encrypted, token_expires_at')
      .eq('member_id', sellerMemberId)
      .maybeSingle();

    if (accountError || !account) {
      return json({ success: false, error: 'Seller Mercado Pago account missing', error_code: 'SELLER_NOT_CONNECTED' }, 409);
    }

    const { data: existingAttempt } = await supabase
      .from('mercado_pago_payment_attempts')
      .select('id, preference_id, init_point, sandbox_init_point, status, expected_amount, expected_currency_code')
      .eq('booking_id', resolved.bookingId)
      .in('status', ['created', 'preference_created', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (
      existingAttempt?.init_point &&
      Number(existingAttempt.expected_amount) === amount &&
      existingAttempt.expected_currency_code === currencyCode
    ) {
      return json(reusePayload({
        attemptId: existingAttempt.id,
        preferenceId: existingAttempt.preference_id,
        initPoint: existingAttempt.init_point,
        sandboxInitPoint: existingAttempt.sandbox_init_point,
        amount,
        currencyCode,
      }));
    }

    const attemptId = crypto.randomUUID();
    const externalReference = encodeMpExternalReference(attemptId);
    const idempotencyKey = await sha256Hex(`mp-pref:${resolved.bookingId}:${amount}:${currencyCode}`);

    const { data: attempt, error: attemptError } = await supabase
      .from('mercado_pago_payment_attempts')
      .insert({
        id: attemptId,
        booking_id: resolved.bookingId,
        member_id: sellerMemberId,
        external_reference: externalReference,
        idempotency_key: `${idempotencyKey}:${attemptId.slice(0, 8)}`,
        expected_amount: amount,
        expected_currency: paymentInfo.currency ?? 0,
        expected_currency_code: currencyCode,
        status: 'created',
      })
      .select('id')
      .single();

    if (attemptError || !attempt) {
      if (attemptError?.code === '23505' && existingAttempt?.init_point) {
        return json(reusePayload({
          attemptId: existingAttempt.id,
          preferenceId: existingAttempt.preference_id,
          initPoint: existingAttempt.init_point,
          sandboxInitPoint: existingAttempt.sandbox_init_point,
          amount,
          currencyCode,
        }));
      }
      console.error('Failed to create payment attempt', attemptError);
      return json({ success: false, error: 'Failed to create payment attempt' }, 500);
    }

    const accessToken = await getValidSellerAccessToken(supabase, account);

    const { data: bookingRow } = await supabase
      .from('Bookings')
      .select('ListingType')
      .eq('Id', resolved.bookingId)
      .maybeSingle();

    const listingType =
      (bookingRow as { ListingType?: string } | null)?.ListingType ?? null;
    const guestOrigin = getGuestPaymentReturnOrigin(listingType);
    const returnBase = guestOrigin || getPublicAppBaseUrl();

    const notificationUrl =
      Deno.env.get('MERCADO_PAGO_NOTIFICATION_URL') ||
      `${supabaseUrl}/functions/v1/mercado-pago-webhook`;

    const preference = await mpApiRequest<PreferenceResponse>('/checkout/preferences', {
      accessToken,
      method: 'POST',
      idempotencyKey,
      body: {
        items: [
          {
            id: resolved.bookingId,
            title: `Reserva ${paymentInfo.reservation_code || resolved.bookingId}`,
            quantity: 1,
            currency_id: currencyCode,
            unit_price: amount,
          },
        ],
        external_reference: externalReference,
        notification_url: notificationUrl,
        back_urls: {
          success: `${returnBase}/pago-mercado-pago/resultado?status=success&bookingId=${resolved.bookingId}`,
          pending: `${returnBase}/pago-mercado-pago/resultado?status=pending&bookingId=${resolved.bookingId}`,
          failure: `${returnBase}/pago-mercado-pago/resultado?status=failure&bookingId=${resolved.bookingId}`,
        },
        auto_return: 'approved',
        metadata: {
          booking_id: resolved.bookingId,
          attempt_id: attemptId,
          seller_member_id: sellerMemberId,
        },
        // marketplace_fee intentionally omitted (zero marketplace fee).
      },
    });

    await supabase
      .from('mercado_pago_payment_attempts')
      .update({
        preference_id: preference.id,
        init_point: preference.init_point ?? null,
        sandbox_init_point: preference.sandbox_init_point ?? null,
        status: 'preference_created',
        updated_at: new Date().toISOString(),
      })
      .eq('id', attemptId);

    return json({
      success: true,
      attemptId,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      amount,
      currencyCode,
      reused: false,
      disclaimerKey: DISCLAIMER_KEY,
    });
  } catch (error) {
    return json(logAndPublicError(error), 500);
  }
});
