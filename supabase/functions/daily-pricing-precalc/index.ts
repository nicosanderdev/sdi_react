/**
 * Daily pricing precompute (phase 2: demand scoring).
 * v1 stub: returns success without writing rows. Schedule via Supabase cron (e.g. 0 3 * * * UTC).
 */
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const horizonDays = typeof body.horizonDays === 'number' ? body.horizonDays : 365;

  return new Response(
    JSON.stringify({
      success: true,
      message: 'daily-pricing-precalc stub (demand scoring not implemented in v1)',
      horizonDays,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
