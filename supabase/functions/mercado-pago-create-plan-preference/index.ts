/**
 * Create Mercado Pago Checkout Pro preference for a company plan.
 * Collector is the platform account (MERCADO_PAGO_ACCESS_TOKEN), not a seller.
 *
 * POST {
 *   kind: 'create_company' | 'change_company',
 *   planId: string,
 *   name?: string,
 *   billingEmail?: string,
 *   description?: string,
 *   companyId?: string
 * }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { authenticateUser } from '../_shared/auth.ts';
import {
  encodeMpExternalReference,
  getPublicAppBaseUrl,
  logAndPublicError,
  mpApiRequest,
  sha256Hex,
} from '../_shared/mercadoPago.ts';

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: 'Missing server environment variables' }, 500);
  }
  if (!accessToken) {
    return json({ success: false, error: 'Mercado Pago is not configured' }, 500);
  }

  const auth = await authenticateUser(req);
  if (!auth.user) {
    return json({ success: false, error: auth.error || 'Unauthorized' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = (await req.json()) as {
      kind?: string;
      planId?: string;
      name?: string;
      billingEmail?: string;
      description?: string;
      companyId?: string;
    };

    const kind = body.kind === 'change_company' ? 'change_company' : 'create_company';
    const planId = body.planId?.trim();
    if (!planId) {
      return json({ success: false, error: 'planId is required' }, 400);
    }

    const { data: member, error: memberError } = await supabase
      .from('Members')
      .select('Id, UserId, Role, EmailVerifiedAt, PhoneVerifiedAt, IsDeleted')
      .eq('UserId', auth.user.id)
      .eq('IsDeleted', false)
      .maybeSingle();

    if (memberError || !member) {
      return json({ success: false, error: 'Member not found' }, 400);
    }

    const { data: plan, error: planError } = await supabase
      .from('Plans')
      .select(
        'Id, Name, Audience, MonthlyPrice, Price, Currency, IsActive, IsActiveV2, IsDeleted',
      )
      .eq('Id', planId)
      .maybeSingle();

    if (planError || !plan || plan.IsDeleted) {
      return json({ success: false, error: 'Plan not found or inactive' }, 400);
    }
    if (plan.Audience !== 'company' || !(plan.IsActiveV2 ?? plan.IsActive)) {
      return json({ success: false, error: 'Plan is not available for this entity type.' }, 400);
    }

    const amount = Number(plan.MonthlyPrice ?? plan.Price ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ success: false, error: 'This plan does not require payment' }, 400);
    }

    const currencyCode = String(plan.Currency || 'UYU').toUpperCase();
    let payload: Record<string, unknown>;

    if (kind === 'create_company') {
      const isPlatformUser = String(member.Role ?? 'user').toLowerCase() === 'user';
      if (isPlatformUser && (!member.EmailVerifiedAt || !member.PhoneVerifiedAt)) {
        return json({
          success: false,
          error:
            'Debes verificar tu correo electrónico y teléfono antes de crear o editar propiedades o empresas. Ve a tu perfil para verificarlos.',
        }, 400);
      }
      const name = body.name?.trim();
      const billingEmail = body.billingEmail?.trim();
      if (!name || !billingEmail) {
        return json({ success: false, error: 'El nombre y el correo de facturación son obligatorios' }, 400);
      }
      payload = {
        name,
        billingEmail,
        description: (body.description ?? '').trim(),
      };
    } else {
      const companyId = body.companyId?.trim();
      if (!companyId) {
        return json({ success: false, error: 'companyId is required' }, 400);
      }
      const { data: membership } = await supabase
        .from('CompanyMembers')
        .select('Role')
        .eq('CompanyId', companyId)
        .eq('MemberId', member.Id)
        .eq('IsDeleted', false)
        .maybeSingle();
      const isAdminRole = String(membership?.Role ?? '').trim() === 'Admin';
      const isPlatformAdmin = String(member.Role ?? '').toLowerCase() === 'admin';
      if (!isAdminRole && !isPlatformAdmin) {
        return json({
          success: false,
          error: 'Solo los administradores de la empresa pueden cambiar el plan.',
        }, 403);
      }
      payload = { companyId };
    }

    const attemptId = crypto.randomUUID();
    const externalReference = encodeMpExternalReference(attemptId);

    const { error: insertError } = await supabase.from('plan_checkout_attempts').insert({
      id: attemptId,
      member_id: member.Id,
      plan_id: planId,
      kind,
      status: 'created',
      amount,
      currency_code: currencyCode,
      payload,
      company_id: kind === 'change_company' ? body.companyId : null,
      external_reference: externalReference,
    });

    if (insertError) {
      console.error('Failed to create plan checkout attempt', insertError);
      return json({ success: false, error: 'Failed to create checkout' }, 500);
    }

    const returnBase = getPublicAppBaseUrl();
    const notificationUrl =
      Deno.env.get('MERCADO_PAGO_NOTIFICATION_URL') ||
      `${supabaseUrl}/functions/v1/mercado-pago-webhook`;
    const idempotencyKey = await sha256Hex(`mp-plan-pref:${attemptId}:${planId}:${amount}`);

    const preference = await mpApiRequest<PreferenceResponse>('/checkout/preferences', {
      accessToken,
      method: 'POST',
      idempotencyKey,
      body: {
        items: [
          {
            id: planId,
            title: `Plan ${plan.Name}`,
            quantity: 1,
            currency_id: currencyCode,
            unit_price: amount,
          },
        ],
        external_reference: externalReference,
        notification_url: notificationUrl,
        back_urls: {
          success: `${returnBase}/dashboard/company/subscription/success?attemptId=${attemptId}`,
          pending: `${returnBase}/dashboard/company/subscription?checkout=pending`,
          failure: `${returnBase}/dashboard/company/subscription?checkout=failure`,
        },
        auto_return: 'approved',
        metadata: {
          kind,
          attempt_id: attemptId,
          plan_id: planId,
          member_id: member.Id,
        },
      },
    });

    await supabase
      .from('plan_checkout_attempts')
      .update({
        preference_id: preference.id,
        init_point: preference.init_point ?? null,
        sandbox_init_point: preference.sandbox_init_point ?? null,
        status: 'preference_created',
        updated_at: new Date().toISOString(),
      })
      .eq('id', attemptId);

    const useSandbox = Deno.env.get('MERCADO_PAGO_USE_SANDBOX') === 'true';
    const checkoutUrl = useSandbox
      ? (preference.sandbox_init_point || preference.init_point)
      : (preference.init_point || preference.sandbox_init_point);

    return json({
      success: true,
      attemptId,
      preferenceId: preference.id,
      checkoutUrl,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      amount,
      currencyCode,
    });
  } catch (error) {
    return json(logAndPublicError(error), 500);
  }
});
