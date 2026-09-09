/**
 * Cron (daily): finalize ended billing cycles — link unbilled usage and create invoices.
 * Uses cron_invoice_ready_cycles() + generate_invoice_for_cycle. Invoke via POST (Supabase Cron).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

type ReadyCycleRow = {
  billing_cycle_id: string
  subject_type: 'member' | 'company'
  member_or_company_id: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const startTime = Date.now()
  let cyclesProcessed = 0
  let invoicesCreated = 0
  const errors: string[] = []

  try {
    const { data: readyRows, error: readyErr } = await supabase.rpc('cron_invoice_ready_cycles')

    if (readyErr) {
      throw new Error(`cron_invoice_ready_cycles: ${readyErr.message}`)
    }

    const rows = (readyRows ?? []) as ReadyCycleRow[]
    cyclesProcessed = rows.length

    for (const row of rows) {
      try {
        const { data: invoiceId, error: invoiceErr } = await supabase.rpc('generate_invoice_for_cycle', {
          p_subject_type: row.subject_type,
          p_subject_id: row.member_or_company_id,
          p_billing_cycle_id: row.billing_cycle_id,
          p_created_by: 'cron-flexible-invoice'
        })
        if (invoiceErr) {
          throw invoiceErr
        }
        if (invoiceId) {
          invoicesCreated++
          try {
            const emailRes = await fetch(
              `${supabaseUrl}/functions/v1/send-flexible-invoice-email`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${supabaseServiceKey}`,
                  'x-cron-secret': Deno.env.get('INVOICE_EMAIL_CRON_SECRET') ?? '',
                },
                body: JSON.stringify({ invoiceId }),
              }
            )
            if (!emailRes.ok) {
              const detail = await emailRes.text()
              errors.push(
                `${row.billing_cycle_id} email: ${emailRes.status} ${detail.slice(0, 200)}`
              )
            }
          } catch (emailErr) {
            errors.push(
              `${row.billing_cycle_id} email: ${(emailErr as Error).message}`
            )
          }
        }
      } catch (e) {
        errors.push(`${row.billing_cycle_id}: ${(e as Error).message}`)
      }
    }

    const body = {
      success: errors.length === 0,
      cyclesProcessed,
      invoicesCreated,
      durationMs: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
        cyclesProcessed,
        invoicesCreated,
        durationMs: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
