const LOCAL_SUPABASE_HOSTS = new Set(['127.0.0.1', 'localhost', 'kong']);

export function isLocalSupabaseRuntime(): boolean {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  try {
    const host = new URL(url).hostname;
    return LOCAL_SUPABASE_HOSTS.has(host);
  } catch {
    return false;
  }
}

/** When true on local Supabase, call Meta instead of dry-run logging. */
export function shouldUseWhatsappMock(): boolean {
  return isLocalSupabaseRuntime() && Deno.env.get('BOOKING_OTP_LIVE_ENABLED') !== 'true';
}

export interface WhatsappSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  mode?: 'live' | 'dry-run';
}

export async function sendWhatsappViaMeta(
  phone: string,
  messageBody: string
): Promise<WhatsappSendResult> {
  if (shouldUseWhatsappMock()) {
    console.log([
      '========== WHATSAPP (local mock) ==========',
      `phone: ${phone}`,
      `message: ${messageBody}`,
      '==========================================',
    ].join('\n'));
    return { ok: true, mode: 'dry-run', messageId: 'local-mock' };
  }

  const token = Deno.env.get('META_WHATSAPP_TOKEN');
  const phoneNumberId = Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !phoneNumberId) {
    return { ok: false, error: 'Meta WhatsApp credentials are missing' };
  }

  const response = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: {
        body: messageBody,
      },
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const apiError = (payload.error as { message?: string } | undefined)?.message;
    return { ok: false, error: apiError ?? `Meta API returned ${response.status}` };
  }

  const messageId = ((payload.messages as Array<{ id?: string }> | undefined)?.[0]?.id ?? undefined);
  return { ok: true, mode: 'live', messageId };
}
