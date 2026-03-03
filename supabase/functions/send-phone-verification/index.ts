import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { userId, newPhone } = await req.json()

    if (!userId || !newPhone) {
      return new Response(
        JSON.stringify({ error: 'User ID and new phone number are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate a 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Store the verification code in the database
    const { error: insertError } = await supabaseClient
      .from('verification_codes')
      .insert({
        user_id: userId,
        phone: newPhone,
        code: verificationCode,
        type: 'phone_change',
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
        created_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('Error storing verification code:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate verification code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send SMS with verification code (you'll need to configure SMS service)
    const smsBody = `Your verification code is: ${verificationCode}. This code will expire in 5 minutes.`

    // For now, we'll log the SMS content (you'll need to integrate with an SMS service like Twilio, etc.)
    console.log('SMS verification code:', {
      to: newPhone,
      body: smsBody,
      code: verificationCode,
    })

    return new Response(
      JSON.stringify({
        message: 'Verification code sent successfully',
        phone: newPhone,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in send-phone-verification:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})