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

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
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
    const normalizedEmail = (email ?? '').trim();
    const normalizedMessage = (message ?? '').trim();

    if (!normalizedName || !normalizedEmail || !normalizedMessage) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    if (!emailRegex.test(normalizedEmail)) {
      return jsonResponse({ error: 'Invalid email format' }, 400);
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const recipientEmail = Deno.env.get('CONTACT_RECIPIENT_EMAIL');
    const fromEmail = Deno.env.get('CONTACT_FROM_EMAIL') ?? 'Contact Form <onboarding@resend.dev>';

    if (!resendApiKey || !recipientEmail) {
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
        subject: `New contact form message from ${normalizedName}`,
        text: [
          `Name: ${normalizedName}`,
          `Email: ${normalizedEmail}`,
          '',
          'Message:',
          normalizedMessage,
        ].join('\n'),
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error('Resend API error:', resendError);
      return jsonResponse({ error: 'Failed to send email' }, 502);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Unhandled send-contact-email error:', error);
    return jsonResponse({ error: 'Unexpected error sending contact message' }, 500);
  }
});
