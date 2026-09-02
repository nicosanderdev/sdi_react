import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ContactPayload = {
  name?: string;
  email?: string;
  message?: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE_LENGTH = 4000;
const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_EMAIL_MAX = 3;
const RATE_LIMIT_IP_MAX = 10;
const RATE_LIMIT_GLOBAL_MAX = 60;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function getClientIp(req: Request): string | null {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (!forwardedFor) return null;
  const firstIp = forwardedFor.split(',')[0]?.trim();
  return firstIp?.length ? firstIp : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const { name, email, message }: ContactPayload = await req.json();

    const normalizedName = (name ?? '').trim();
    const normalizedEmail = (email ?? '').trim().toLowerCase();
    const normalizedMessage = (message ?? '').trim();

    if (!normalizedName || !normalizedEmail || !normalizedMessage) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    if (!emailRegex.test(normalizedEmail)) {
      return jsonResponse({ error: 'Invalid email format' }, 400);
    }

    if (normalizedMessage.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse({ error: 'Message is too long' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Could not evaluate rate limits' }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const requestIp = getClientIp(req);
    const { data: rateLimitData, error: rateLimitError } = await supabaseAdmin.rpc(
      'check_and_increment_contact_email_rate_limit',
      {
        p_email: normalizedEmail,
        p_ip: requestIp,
        p_email_max_hits: RATE_LIMIT_EMAIL_MAX,
        p_ip_max_hits: RATE_LIMIT_IP_MAX,
        p_global_max_hits: RATE_LIMIT_GLOBAL_MAX,
        p_window_minutes: RATE_LIMIT_WINDOW_MINUTES,
      },
    );

    if (rateLimitError) {
      console.error('Contact email rate limit RPC error:', rateLimitError);
      return jsonResponse({ error: 'Could not evaluate rate limits' }, 500);
    }

    const allowed = Boolean((rateLimitData as { allowed?: boolean } | null)?.allowed);
    if (!allowed) {
      const reason = (rateLimitData as { reason?: string } | null)?.reason ?? 'unknown';
      console.warn('Contact email rate limited:', { reason });
      return jsonResponse({ error: 'Too many requests' }, 429);
    }

    const sendEmailsEnabled = Deno.env.get('SEND_EMAILS_ENABLED') === 'true';
    const recipientEmail = Deno.env.get('CONTACT_RECIPIENT_EMAIL');
    const fromEmail = Deno.env.get('CONTACT_FROM_EMAIL') ?? 'Contact Form <onboarding@resend.dev>';
    const subject = `New contact form message from ${normalizedName}`;
    const text = [
      `Name: ${normalizedName}`,
      `Email: ${normalizedEmail}`,
      '',
      'Message:',
      normalizedMessage,
    ].join('\n');

    if (!recipientEmail) {
      return jsonResponse({ error: 'Function email configuration is missing' }, 500);
    }

    if (!sendEmailsEnabled) {
      console.log('Dry-run contact email:', {
        mode: 'dry-run',
        from: fromEmail,
        to: [recipientEmail],
        reply_to: normalizedEmail,
        subject,
        textLength: text.length,
      });
      return jsonResponse({ success: true, mode: 'dry-run' });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      return jsonResponse({ error: 'Function email configuration is missing' }, 500);
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        reply_to: normalizedEmail,
        subject,
        text,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error('Resend API error:', resendError);
      return jsonResponse({ error: 'Failed to send email' }, 502);
    }

    return jsonResponse({ success: true, mode: 'live' });
  } catch (error) {
    console.error('Unhandled send-contact-email error:', error);
    return jsonResponse({ error: 'Unexpected error sending contact message' }, 500);
  }
});
