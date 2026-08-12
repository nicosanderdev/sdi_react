import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Note: This is a template implementation. You'll need to:
// 1. Configure webhook endpoint in DLocal dashboard
// 2. Implement DLocal webhook signature verification
// 3. Ensure proper error handling and idempotency

interface DLocalWebhookPayload {
  id: string // DLocal payment ID
  amount: number
  currency: string
  status: 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED'
  payment_method: {
    type: string
    card?: {
      brand: string
      last4: string
    }
  }
  customer: {
    id: string
    email: string
  }
  order_id?: string // Our payment_intent_id
  created_date: string
  approved_date?: string
  // ... other DLocal fields
}

type BillingSubjectType = 'member' | 'company'

interface BillingSubject {
  subjectType: BillingSubjectType
  memberOrCompanyId: string
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get webhook payload
    const payload: DLocalWebhookPayload = await req.json()
    const { id: dlocalPaymentId, status, order_id: paymentIntentId, amount, currency, approved_date } = payload

    if (!paymentIntentId) {
      console.error('No payment_intent_id in webhook payload')
      return new Response(JSON.stringify({ error: 'Missing payment_intent_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get payment intent
    const { data: paymentIntent, error: intentError } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', paymentIntentId)
      .single()

    if (intentError || !paymentIntent) {
      console.error('Payment intent not found:', paymentIntentId)
      return new Response(JSON.stringify({ error: 'Payment intent not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if payment intent is already processed (idempotency)
    if (paymentIntent.status !== 'pending') {
      console.log('Payment intent already processed:', paymentIntentId)
      return new Response(JSON.stringify({ message: 'Already processed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const now = new Date().toISOString()
    const currentPeriodStart = approved_date || now
    const currentPeriodEnd = new Date(currentPeriodStart)
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1) // 1 month subscription

    if (status === 'PAID') {
      if (paymentIntent.entity_type === 'user') {
        console.error('Rejected member plan activation via payment webhook:', paymentIntentId)
        return new Response(JSON.stringify({
          error: 'Member self-serve plan changes are disabled. Platform admins must assign member plans.'
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { error: updateIntentError } = await supabase
        .from('payment_intents')
        .update({
          status: 'succeeded',
          updated_at: now
        })
        .eq('id', paymentIntentId)

      if (updateIntentError) {
        console.error('Error updating payment intent:', updateIntentError)
      }

      let subject: BillingSubject | null = null

      if (paymentIntent.entity_type === 'company') {
        subject = { subjectType: 'company', memberOrCompanyId: paymentIntent.entity_id }
      }

      if (!subject) {
        return new Response(JSON.stringify({ error: 'No billing subject for payment entity' }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data: existingAssignment } = await supabase
        .from('BillingPlanAssignments')
        .select('Id')
        .eq('SubjectType', subject.subjectType)
        .eq('MemberOrCompanyId', subject.memberOrCompanyId)
        .eq('IsActive', true)
        .order('StartDate', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingAssignment?.Id) {
        await supabase
          .from('BillingPlanAssignments')
          .update({
            PlanId: paymentIntent.plan_id,
            StartDate: currentPeriodStart,
            EndDate: currentPeriodEnd.toISOString(),
            LastModified: now
          })
          .eq('Id', existingAssignment.Id)
      } else {
        await supabase.from('BillingPlanAssignments').insert({
          SubjectType: subject.subjectType,
          MemberOrCompanyId: subject.memberOrCompanyId,
          PlanId: paymentIntent.plan_id,
          StartDate: currentPeriodStart,
          EndDate: currentPeriodEnd.toISOString(),
          IsActive: true,
          Created: now,
          LastModified: now
        })
      }

      const { data: cycle } = await supabase
        .from('BillingCycles')
        .insert({
          SubjectType: subject.subjectType,
          MemberOrCompanyId: subject.memberOrCompanyId,
          StartDate: currentPeriodStart,
          EndDate: currentPeriodEnd.toISOString(),
          Status: 'closed',
          TotalAmount: amount / 100,
          CreatedAt: now,
          UpdatedAt: now
        })
        .select('Id')
        .single()

      if (cycle?.Id) {
        await supabase.from('Invoices').insert({
          SubjectType: subject.subjectType,
          MemberOrCompanyId: subject.memberOrCompanyId,
          BillingCycleId: cycle.Id,
          Total: amount / 100,
          Status: 'paid',
          CreatedAt: now,
          UpdatedAt: now
        })
      }

      const receiptData = {
        payment_intent_id: paymentIntentId,
        dlocal_payment_id: dlocalPaymentId,
        amount: amount / 100,
        currency,
        created_at: now
      }

      console.log(
        'Payment succeeded, subscription activated for:',
        subject.subjectType,
        subject.memberOrCompanyId,
        receiptData
      )
    } else {
      const { error: updateIntentError } = await supabase
        .from('payment_intents')
        .update({
          status: 'failed',
          updated_at: now
        })
        .eq('id', paymentIntentId)

      if (updateIntentError) {
        console.error('Error updating payment intent:', updateIntentError)
      }

      console.log('Payment failed for:', paymentIntentId, status)
    }

    return new Response(JSON.stringify({ message: 'Webhook processed successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Unexpected error in webhook:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
