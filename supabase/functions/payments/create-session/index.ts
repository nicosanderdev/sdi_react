import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Note: This is a template implementation. You'll need to:
// 1. Create the payment_intents table in your database
// 2. Set up DLocal API credentials
// 3. Implement proper error handling and validation

interface CreateSessionRequest {
  entity_type: 'user' | 'company'
  entity_id: string
  plan_id: string
}

interface PaymentIntent {
  id: string
  entity_type: string
  entity_id: string
  plan_id: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  dlocal_session_id?: string
  created_at: string
  updated_at: string
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

    // Get request body
    const body: CreateSessionRequest = await req.json()
    const { entity_type, entity_id, plan_id } = body

    // Validate request
    if (!entity_type || !entity_id || !plan_id) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: entity_type, entity_id, plan_id'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!['user', 'company'].includes(entity_type)) {
      return new Response(JSON.stringify({
        error: 'entity_type must be either "user" or "company"'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('Plans')
      .select('*')
      .eq('Id', plan_id)
      .eq('IsActive', true)
      .eq('IsDeleted', false)
      .single()

    if (planError || !plan) {
      return new Response(JSON.stringify({
        error: 'Plan not found or inactive'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate entity exists
    if (entity_type === 'user') {
      const { data: user, error: userError } = await supabase
        .from('Members')
        .select('Id')
        .eq('UserId', entity_id)
        .eq('IsDeleted', false)
        .single()

      if (userError || !user) {
        return new Response(JSON.stringify({
          error: 'User not found'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else if (entity_type === 'company') {
      const { data: company, error: companyError } = await supabase
        .from('Companies')
        .select('Id')
        .eq('Id', entity_id)
        .eq('IsDeleted', false)
        .single()

      if (companyError || !company) {
        return new Response(JSON.stringify({
          error: 'Company not found'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Calculate amount (convert to cents for DLocal if needed)
    const amount = plan.MonthlyPrice * 100 // Assuming DLocal expects cents

    // Create payment intent record
    // Note: This assumes you have a payment_intents table with the following structure:
    // id (uuid), entity_type (text), entity_id (uuid), plan_id (uuid),
    // amount (integer), currency (text), status (text), dlocal_session_id (text),
    // created_at (timestamp), updated_at (timestamp)

    const paymentIntentId = crypto.randomUUID()

    const { error: insertError } = await supabase
      .from('payment_intents')
      .insert({
        id: paymentIntentId,
        entity_type,
        entity_id,
        plan_id,
        amount,
        currency: plan.Currency || 'EUR',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('Error creating payment intent:', insertError)
      return new Response(JSON.stringify({
        error: 'Failed to create payment intent'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create DLocal payment session
    // Note: You'll need to implement the actual DLocal API call here
    // This is a placeholder implementation

    const dlocalApiKey = Deno.env.get('DLOCAL_API_KEY')
    const dlocalSecretKey = Deno.env.get('DLOCAL_SECRET_KEY')

    if (!dlocalApiKey || !dlocalSecretKey) {
      console.error('DLocal API credentials not configured')
      return new Response(JSON.stringify({
        error: 'Payment service not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Mock DLocal session creation (replace with actual API call)
    const mockDlocalSession = {
      session_id: `dlocal_session_${Date.now()}`,
      checkout_url: `https://checkout.dlocal.com/session/${paymentIntentId}`,
      amount: amount / 100, // Convert back to euros for display
      currency: plan.Currency || 'EUR'
    }

    // Update payment intent with DLocal session ID
    const { error: updateError } = await supabase
      .from('payment_intents')
      .update({
        dlocal_session_id: mockDlocalSession.session_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentIntentId)

    if (updateError) {
      console.error('Error updating payment intent:', updateError)
      // Don't fail the request, just log the error
    }

    // Return checkout URL to React app
    return new Response(JSON.stringify({
      checkout_url: mockDlocalSession.checkout_url,
      payment_intent_id: paymentIntentId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
