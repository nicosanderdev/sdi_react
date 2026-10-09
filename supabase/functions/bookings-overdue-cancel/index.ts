/**
 * Cron: cancel bookings past deposit or balance deadlines; mark overdue refunds.
 * POST (service role / scheduled). Invokes cancel_overdue_bookings RPC.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { logCronExecution } from '../_shared/adminActivityLog.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const startTime = Date.now()
  let limit = 100
  try {
    const body = await req.json().catch(() => ({}))
    if (body?.limit != null) {
      const n = Number(body.limit)
      if (Number.isFinite(n) && n > 0) limit = Math.min(n, 500)
    }
  } catch {
    /* ignore */
  }

  try {
    const { data, error } = await supabase.rpc('cancel_overdue_bookings', {
      p_limit: limit,
    })

    if (error) {
      console.error('cancel_overdue_bookings failed', error)
      await logCronExecution(req, 'bookings-overdue-cancel', false, error.message)
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cancelled = Number(data?.cancelled ?? 0)
    const summary =
      `${cancelled} cancelled (deposit=${data?.depositCancels ?? 0}, balance=${data?.balanceCancels ?? 0})`
    await logCronExecution(req, 'bookings-overdue-cancel', true, summary, {
      ...(data as Record<string, unknown>),
      durationMs: Date.now() - startTime,
    })

    return new Response(JSON.stringify({ success: true, ...data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('bookings-overdue-cancel error', message)
    await logCronExecution(req, 'bookings-overdue-cancel', false, message, {
      durationMs: Date.now() - startTime,
    })
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
