/**
 * Cron: generate invoices for active member plans using DB pricing RPCs.
 * Invoke via Supabase Cron (POST).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const DEFAULT_CYCLE_DAYS = 30

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
  let invoicesCreated = 0
  let plansProcessed = 0
  const errors: string[] = []

  try {
    const { data: memberPlans, error: plansError } = await supabase
      .from('MemberPlans')
      .select('Id, MemberId, PlanId, StartDate, EndDate, IsActive, Plans(DurationDays)')
      .eq('IsActive', true)

    if (plansError) {
      throw new Error(`MemberPlans: ${plansError.message}`)
    }

    const rows = memberPlans ?? []
    plansProcessed = rows.length

    for (const row of rows as any[]) {
      try {
        const now = new Date()
        const cycleDays = Number(row.Plans?.DurationDays ?? DEFAULT_CYCLE_DAYS)
        const startDate = row.EndDate ? new Date(row.EndDate) : new Date(row.StartDate ?? now.toISOString())
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + cycleDays)

        const { data: existingCycle } = await supabase
          .from('BillingCycles')
          .select('Id')
          .eq('MemberId', row.MemberId)
          .eq('StartDate', startDate.toISOString())
          .eq('EndDate', endDate.toISOString())
          .limit(1)
          .maybeSingle()

        let cycleId = existingCycle?.Id
        if (!cycleId) {
          const { data: insertedCycle, error: cycleErr } = await supabase
            .from('BillingCycles')
            .insert({
              MemberId: row.MemberId,
              StartDate: startDate.toISOString(),
              EndDate: endDate.toISOString(),
              Status: 'open',
              TotalAmount: 0,
              CreatedAt: now.toISOString(),
              UpdatedAt: now.toISOString()
            })
            .select('Id')
            .single()
          if (cycleErr) {
            throw cycleErr
          }
          cycleId = insertedCycle?.Id
        }

        if (cycleId) {
          const { data: invoiceId, error: invoiceErr } = await supabase
            .rpc('generate_invoice_for_cycle', {
              p_member_id: row.MemberId,
              p_billing_cycle_id: cycleId,
              p_created_by: 'receipts-generate-cron'
            })
          if (invoiceErr) {
            throw invoiceErr
          }
          if (invoiceId) {
            invoicesCreated++
          }
        }
      } catch (e) {
        errors.push(`${row.Id}: ${(e as Error).message}`)
      }
    }

    const body = {
      success: errors.length === 0,
      plansProcessed,
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
        plansProcessed,
        invoicesCreated,
        durationMs: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
