/**
 * Cron: Generate booking commission receipts for all active subscriptions.
 * Free: create receipt when min amount or 15 days; DueDate = now + 7 days.
 * Pro/Business: create receipt every 30 days; DueDate = now + 15 days.
 * Invoke via Supabase Cron (POST).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const FREE_RECEIPT_DAYS = 15
const FREE_PAY_DAYS = 7
const PRO_RECEIPT_DAYS = 30
const PRO_PAY_DAYS = 15
const BOOKING_STATUS_CONFIRMED = 1
const BOOKING_STATUS_COMPLETED = 3
const RECEIPT_STATUS_PENDING = 0

function computeCommission(
  totalAmount: number,
  commissionPct: number | null,
  commissionMin: number | null
): number {
  const pct = commissionPct ?? 0
  const min = commissionMin ?? 0
  const fromPct = totalAmount * (pct / 100)
  return Math.max(fromPct, min)
}

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

async function getPaidBookingIds(subscriptionId: string): Promise<Set<string>> {
  const { data: receipts } = await supabase
    .from('BookingReceipts')
    .select('Id')
    .eq('SubscriptionId', subscriptionId)
    .not('PaidAt', 'is', null)
    .eq('IsDeleted', false)
  const receiptIds = (receipts ?? []).map((r: { Id: string }) => r.Id)
  if (receiptIds.length === 0) return new Set<string>()
  const { data: items } = await supabase
    .from('BookingReceiptItems')
    .select('BookingId')
    .in('BookingReceiptId', receiptIds)
  return new Set((items ?? []).map((i: { BookingId: string }) => i.BookingId))
}

interface UnpaidRow {
  Id: string
  TotalAmount: number | null
  Created: string
}

async function getUnpaidBookings(
  subscriptionId: string,
  propertyIds: string[]
): Promise<UnpaidRow[]> {
  if (propertyIds.length === 0) return []
  const paidIds = await getPaidBookingIds(subscriptionId)
  const { data: bookings } = await supabase
    .from('Bookings')
    .select('Id, TotalAmount, Created')
    .in('EstatePropertyId', propertyIds)
    .in('Status', [BOOKING_STATUS_CONFIRMED, BOOKING_STATUS_COMPLETED])
    .eq('IsDeleted', false)
    .order('Created', { ascending: true })
  const rows = (bookings ?? []) as UnpaidRow[]
  return rows.filter((b) => !paidIds.has(b.Id))
}

async function getLastReceiptCreated(subscriptionId: string): Promise<Date | null> {
  const { data } = await supabase
    .from('BookingReceipts')
    .select('Created')
    .eq('SubscriptionId', subscriptionId)
    .eq('IsDeleted', false)
    .order('Created', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.Created ? new Date(data.Created) : null
}

async function createReceipt(
  subscriptionId: string,
  currency: string,
  items: { bookingId: string; amount: number }[],
  dueDate: Date
): Promise<string | null> {
  const amount = items.reduce((s, i) => s + i.amount, 0)
  const { data: receipt, error: receiptError } = await supabase
    .from('BookingReceipts')
    .insert({
      SubscriptionId: subscriptionId,
      Amount: amount,
      Currency: currency,
      DueDate: dueDate.toISOString(),
      PaidAt: null,
      Status: RECEIPT_STATUS_PENDING,
      IsDeleted: false
    })
    .select('Id')
    .single()
  if (receiptError || !receipt) return null
  for (const item of items) {
    await supabase.from('BookingReceiptItems').insert({
      BookingReceiptId: receipt.Id,
      BookingId: item.bookingId,
      Amount: item.amount
    })
  }
  return receipt.Id
}

interface SubRow {
  Id: string
  OwnerType: number
  OwnerId: string
  Plans: {
    Key: number
    Currency: string
    Id: string
    CommissionPercentage: number | null
    CommissionMinimumAmount: number | null
    BookingReceiptMinimumAmount: number | null
  }
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
  let receiptsCreated = 0
  let subscriptionsProcessed = 0
  const errors: string[] = []

  try {
    const { data: subs, error: subsError } = await supabase
      .from('Subscriptions')
      .select('Id, OwnerType, OwnerId, Plans(Key, Currency, Id, CommissionPercentage, CommissionMinimumAmount, BookingReceiptMinimumAmount)')
      .eq('Status', 1)
      .eq('IsDeleted', false)

    if (subsError) {
      throw new Error(`Subscriptions: ${subsError.message}`)
    }

    const subscriptions = (subs ?? []) as SubRow[]
    subscriptionsProcessed = subscriptions.length

    for (const sub of subscriptions) {
      try {
        const plan = sub.Plans
        if (!plan) continue
        const ownerIds = await getOwnerIds(sub.OwnerType, sub.OwnerId)
        const propertyIds = await getPropertyIds(ownerIds)
        const unpaidRows = await getUnpaidBookings(sub.Id, propertyIds)
        if (unpaidRows.length === 0) continue

        const pct = plan.CommissionPercentage ?? 0
        const minAmt = plan.CommissionMinimumAmount ?? 0
        const receiptMinAmount = plan.BookingReceiptMinimumAmount ?? 0
        const currency = plan.Currency ?? 'USD'

        const unpaidWithCommission = unpaidRows.map((b) => {
          const total = b.TotalAmount != null ? Number(b.TotalAmount) : 0
          const amount = computeCommission(total, pct, minAmt)
          return { Id: b.Id, commission: amount }
        })
        const totalUnpaidCommission = unpaidWithCommission.reduce((s, b) => s + b.commission, 0)
        const earliestDate = new Date(unpaidRows[0].Created)
        const now = new Date()

        const isFree = plan.Key === 0
        const isProOrBusiness = plan.Key === 1 || plan.Key === 2

        if (isFree) {
          const daysSinceFirst = (now.getTime() - earliestDate.getTime()) / (24 * 60 * 60 * 1000)
          const hitMinAmount = totalUnpaidCommission >= receiptMinAmount
          const hit15Days = daysSinceFirst >= FREE_RECEIPT_DAYS
          if (hitMinAmount || hit15Days) {
            const dueDate = new Date()
            dueDate.setDate(dueDate.getDate() + FREE_PAY_DAYS)
            const id = await createReceipt(
              sub.Id,
              currency,
              unpaidWithCommission.map((b) => ({ bookingId: b.Id, amount: b.commission })),
              dueDate
            )
            if (id) receiptsCreated++
          }
        }

        if (isProOrBusiness) {
          const lastReceipt = await getLastReceiptCreated(sub.Id)
          const periodStart = lastReceipt ?? earliestDate
          const daysSincePeriod =
            (now.getTime() - new Date(periodStart).getTime()) / (24 * 60 * 60 * 1000)
          if (daysSincePeriod >= PRO_RECEIPT_DAYS) {
            const dueDate = new Date()
            dueDate.setDate(dueDate.getDate() + PRO_PAY_DAYS)
            const id = await createReceipt(
              sub.Id,
              currency,
              unpaidWithCommission.map((b) => ({ bookingId: b.Id, amount: b.commission })),
              dueDate
            )
            if (id) receiptsCreated++
          }
        }
      } catch (e) {
        errors.push(`${sub.Id}: ${(e as Error).message}`)
      }
    }

    const body = {
      success: errors.length === 0,
      subscriptionsProcessed,
      receiptsCreated,
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
        subscriptionsProcessed,
        receiptsCreated,
        durationMs: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
