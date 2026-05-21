/**
 * Cron (daily): pending flexible Invoices overdue past grace → take listings off-market.
 * Env: INVOICE_OVERDUE_GRACE_DAYS (default 14) after effective due date.
 * Effective due = coalesce(DueDate, CreatedAt + 7 days).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const DEFAULT_GRACE_DAYS = 14
const EFFECTIVE_DUE_FALLBACK_DAYS = 7

function parseGraceDays(): number {
  const raw = Deno.env.get('INVOICE_OVERDUE_GRACE_DAYS')
  if (!raw?.trim()) return DEFAULT_GRACE_DAYS
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_GRACE_DAYS
}

function effectiveDueMs(row: { DueDate: string | null; CreatedAt: string }): number {
  if (row.DueDate) {
    return new Date(row.DueDate).getTime()
  }
  const created = new Date(row.CreatedAt)
  created.setDate(created.getDate() + EFFECTIVE_DUE_FALLBACK_DAYS)
  return created.getTime()
}

type BillingSubject = {
  subjectType: 'member' | 'company'
  memberOrCompanyId: string
}

async function collectOwnerIdsForSubject(subject: BillingSubject): Promise<string[]> {
  const ownerIds = new Set<string>()

  if (subject.subjectType === 'member') {
    const { data: directOwners } = await supabase
      .from('Owners')
      .select('Id')
      .eq('MemberId', subject.memberOrCompanyId)
      .eq('OwnerType', 'member')
      .eq('IsDeleted', false)

    for (const o of directOwners ?? []) {
      ownerIds.add((o as { Id: string }).Id)
    }
    return [...ownerIds]
  }

  const { data: companyOwners } = await supabase
    .from('Owners')
    .select('Id')
    .eq('OwnerType', 'company')
    .eq('CompanyId', subject.memberOrCompanyId)
    .eq('IsDeleted', false)

  for (const o of companyOwners ?? []) {
    ownerIds.add((o as { Id: string }).Id)
  }

  return [...ownerIds]
}

async function getEstatePropertyIdsForOwners(ownerIds: string[]): Promise<string[]> {
  if (ownerIds.length === 0) return []
  const { data: props } = await supabase
    .from('EstateProperties')
    .select('Id')
    .in('OwnerId', ownerIds)
    .eq('IsDeleted', false)

  return (props ?? []).map((r: { Id: string }) => r.Id)
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
  const graceDays = parseGraceDays()
  const graceMs = graceDays * 24 * 60 * 60 * 1000
  const nowMs = Date.now()
  let invoicesReviewed = 0
  let subjectsAffected = 0
  let listingsUpdated = 0
  const errors: string[] = []

  try {
    const { data: pendingInvoices, error: invErr } = await supabase
      .from('Invoices')
      .select('Id, SubjectType, MemberOrCompanyId, DueDate, CreatedAt, Status')
      .eq('Status', 'pending')

    if (invErr) {
      throw new Error(`Invoices: ${invErr.message}`)
    }

    const overdueSubjects = new Map<string, BillingSubject>()
    const rows = pendingInvoices ?? []

    for (const inv of rows as {
      Id: string
      SubjectType: 'member' | 'company'
      MemberOrCompanyId: string
      DueDate: string | null
      CreatedAt: string
      Status: string
    }[]) {
      invoicesReviewed++
      const dueCutoff = effectiveDueMs(inv) + graceMs
      if (dueCutoff >= nowMs) continue
      const key = `${inv.SubjectType}:${inv.MemberOrCompanyId}`
      overdueSubjects.set(key, {
        subjectType: inv.SubjectType,
        memberOrCompanyId: inv.MemberOrCompanyId
      })
    }

    for (const subject of overdueSubjects.values()) {
      try {
        const ownerIds = await collectOwnerIdsForSubject(subject)
        const propertyIds = await getEstatePropertyIdsForOwners(ownerIds)
        if (propertyIds.length === 0) {
          continue
        }

        const { data: upd, error: listErr } = await supabase
          .from('Listings')
          .update({
            IsPropertyVisible: false,
            IsActive: false,
            LastModified: new Date().toISOString()
          })
          .in('EstatePropertyId', propertyIds)
          .eq('IsDeleted', false)
          .select('Id')

        if (listErr) {
          throw listErr
        }

        subjectsAffected++
        listingsUpdated += (upd ?? []).length
      } catch (e) {
        errors.push(
          `${subject.subjectType}/${subject.memberOrCompanyId}: ${(e as Error).message}`
        )
      }
    }

    const body = {
      success: errors.length === 0,
      graceDays,
      invoicesReviewed,
      overdueSubjects: overdueSubjects.size,
      subjectsAffected,
      listingsUpdated,
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
        invoicesReviewed,
        subjectsAffected,
        listingsUpdated,
        durationMs: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
