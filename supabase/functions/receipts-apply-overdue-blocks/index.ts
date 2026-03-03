/**
 * Cron: Apply overdue blocks — set BlockedForBooking = true for properties
 * whose subscription has an unpaid receipt past DueDate + grace days.
 * Free: grace 7 days; Pro/Business: grace 15 days.
 * Invoke via Supabase Cron (POST).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const FREE_BLOCK_GRACE_DAYS = 7
const PRO_BLOCK_GRACE_DAYS = 15

async function getOwnerIds(ownerType: number, ownerId: string): Promise<string[]> {
  if (ownerType === 0) {
    const { data: members } = await supabase
      .from('Members')
      .select('Id')
      .eq('UserId', ownerId)
      .eq('IsDeleted', false)
    const memberIds = (members ?? []).map((m: { Id: string }) => m.Id)
    if (memberIds.length === 0) return []
    const { data: owners } = await supabase
      .from('Owners')
      .select('Id')
      .eq('OwnerType', 'member')
      .in('MemberId', memberIds)
      .eq('IsDeleted', false)
    return (owners ?? []).map((o: { Id: string }) => o.Id)
  }
  if (ownerType === 1) {
    const { data: owners } = await supabase
      .from('Owners')
      .select('Id')
      .eq('OwnerType', 'company')
      .eq('CompanyId', ownerId)
      .eq('IsDeleted', false)
    return (owners ?? []).map((o: { Id: string }) => o.Id)
  }
  return []
}

async function getPropertyIds(ownerIds: string[]): Promise<string[]> {
  if (ownerIds.length === 0) return []
  const { data: rows } = await supabase
    .from('EstateProperties')
    .select('Id')
    .in('OwnerId', ownerIds)
    .eq('IsDeleted', false)
  return (rows ?? []).map((r: { Id: string }) => r.Id)
}

/** Get latest EstatePropertyValues Id per property (by Created desc). */
async function getLatestValueIdsByProperty(
  propertyIds: string[]
): Promise<Record<string, string>> {
  if (propertyIds.length === 0) return {}
  const { data: values } = await supabase
    .from('EstatePropertyValues')
    .select('Id, EstatePropertyId, Created')
    .in('EstatePropertyId', propertyIds)
    .eq('IsDeleted', false)
  const byProperty: Record<string, { Id: string; Created: string }> = {}
  for (const v of values ?? []) {
    const key = v.EstatePropertyId
    const existing = byProperty[key]
    if (
      !existing ||
      new Date(v.Created).getTime() > new Date(existing.Created).getTime()
    ) {
      byProperty[key] = { Id: v.Id, Created: v.Created }
    }
  }
  const out: Record<string, string> = {}
  for (const [propId, v] of Object.entries(byProperty)) {
    out[propId] = v.Id
  }
  return out
}

async function setBlockedForBooking(valueIds: string[], blocked: boolean): Promise<void> {
  if (valueIds.length === 0) return
  await supabase
    .from('EstatePropertyValues')
    .update({
      BlockedForBooking: blocked,
      LastModified: new Date().toISOString()
    })
    .in('Id', valueIds)
}

interface SubRow {
  Id: string
  OwnerType: number
  OwnerId: string
  Plans: { Key: number } | null
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
  let subscriptionsBlocked = 0
  const errors: string[] = []

  try {
    const { data: subs, error: subsError } = await supabase
      .from('Subscriptions')
      .select('Id, OwnerType, OwnerId, Plans(Key)')
      .eq('Status', 1)
      .eq('IsDeleted', false)

    if (subsError) {
      throw new Error(`Subscriptions: ${subsError.message}`)
    }

    const subscriptions = (subs ?? []) as SubRow[]
    const now = new Date()

    for (const sub of subscriptions) {
      try {
        const planKey = sub.Plans?.Key ?? 0
        const graceDays = planKey === 0 ? FREE_BLOCK_GRACE_DAYS : PRO_BLOCK_GRACE_DAYS
        const cutoff = new Date(now)
        cutoff.setDate(cutoff.getDate() - graceDays)

        const { data: overdue } = await supabase
          .from('BookingReceipts')
          .select('Id')
          .eq('SubscriptionId', sub.Id)
          .eq('IsDeleted', false)
          .is('PaidAt', null)
          .lt('DueDate', cutoff.toISOString())
          .limit(1)

        if (!overdue || overdue.length === 0) continue

        const ownerIds = await getOwnerIds(sub.OwnerType, sub.OwnerId)
        const propertyIds = await getPropertyIds(ownerIds)
        if (propertyIds.length === 0) continue

        const latestIds = await getLatestValueIdsByProperty(propertyIds)
        const valueIds = Object.values(latestIds)
        await setBlockedForBooking(valueIds, true)
        subscriptionsBlocked++
      } catch (e) {
        errors.push(`${sub.Id}: ${(e as Error).message}`)
      }
    }

    const body = {
      success: errors.length === 0,
      subscriptionsBlocked,
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
        subscriptionsBlocked: 0,
        durationMs: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
