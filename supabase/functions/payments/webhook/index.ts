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

    // Validate webhook (you should implement DLocal signature verification here)
    // const isValidSignature = verifyDLocalSignature(req.headers, payload)
    // if (!isValidSignature) {
    //   return new Response(JSON.stringify({ error: 'Invalid signature' }), {
    //     status: 401,
    //     headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    //   })
    // }

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
      // Payment succeeded - create subscription and billing records

      // Update payment intent
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

      // New billing model: map intent to member and create/update MemberPlans + BillingCycles + Invoices
      let memberId: string | null = null
      if (paymentIntent.entity_type === 'user') {
        const { data: member } = await supabase
          .from('Members')
          .select('Id')
          .eq('UserId', paymentIntent.entity_id)
          .eq('IsDeleted', false)
          .maybeSingle()
        memberId = member?.Id ?? null
      } else {
        const { data: companyMember } = await supabase
          .from('CompanyMembers')
          .select('MemberId')
          .eq('CompanyId', paymentIntent.entity_id)
          .eq('IsDeleted', false)
          .limit(1)
          .maybeSingle()
        memberId = companyMember?.MemberId ?? null
      }

      if (!memberId) {
        return new Response(JSON.stringify({ error: 'No member mapping for payment entity' }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data: existingMemberPlan } = await supabase
        .from('MemberPlans')
        .select('Id')
        .eq('MemberId', memberId)
        .eq('IsActive', true)
        .order('StartDate', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingMemberPlan?.Id) {
        await supabase
          .from('MemberPlans')
          .update({
            PlanId: paymentIntent.plan_id,
            StartDate: currentPeriodStart,
            EndDate: currentPeriodEnd.toISOString(),
            LastModified: now
          })
          .eq('Id', existingMemberPlan.Id)
      } else {
        await supabase
          .from('MemberPlans')
          .insert({
            MemberId: memberId,
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
          MemberId: memberId,
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
        await supabase
          .from('Invoices')
          .insert({
            MemberId: memberId,
            BillingCycleId: cycle.Id,
            Total: amount / 100,
            Status: 'paid',
            CreatedAt: now,
            UpdatedAt: now
          })
      }

      // Create payment receipt record
      // Note: This assumes you have a PaymentReceipts table
      const receiptData = {
        // Add your receipt fields here based on your schema
        payment_intent_id: paymentIntentId,
        dlocal_payment_id: dlocalPaymentId,
        amount: amount / 100,
        currency,
        created_at: now
      }

      // Uncomment when you have the PaymentReceipts table
      // const { error: receiptError } = await supabase
      //   .from('PaymentReceipts')
      //   .insert(receiptData)

      // if (receiptError) {
      //   console.error('Error creating payment receipt:', receiptError)
      // }

      console.log('Payment succeeded, subscription activated for:', paymentIntent.entity_type, paymentIntent.entity_id)

    } else {
      // Payment failed or was cancelled/expired
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

    // Return success response to DLocal
    return new Response(JSON.stringify({ message: 'Webhook processed successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Unexpected error in webhook:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
