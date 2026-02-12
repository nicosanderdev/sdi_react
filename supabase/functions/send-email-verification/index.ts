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

    const { userId, newEmail } = await req.json()

    if (!userId || !newEmail) {
      return new Response(
        JSON.stringify({ error: 'User ID and new email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate a 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Store the verification code in the database (you'll need a verification_codes table)
    const { error: insertError } = await supabaseClient
      .from('verification_codes')
      .insert({
        user_id: userId,
        email: newEmail,
        code: verificationCode,
        type: 'email_change',
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

    // Send email with verification code (you'll need to configure email service)
    const emailBody = `
      <h2>Verify Your New Email Address</h2>
      <p>You requested to change your email address to: <strong>${newEmail}</strong></p>
      <p>Your verification code is: <strong style="font-size: 24px; color: #4F46E5;">${verificationCode}</strong></p>
      <p>This code will expire in 5 minutes.</p>
      <p>If you didn't request this change, please ignore this email.</p>
    `

    // For now, we'll log the email content (you'll need to integrate with an email service like Resend, SendGrid, etc.)
    console.log('Email verification code:', {
      to: newEmail,
      subject: 'Verify Your New Email Address',
      body: emailBody,
      code: verificationCode,
    })

    return new Response(
      JSON.stringify({
        message: 'Verification code sent successfully',
        email: newEmail,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in send-email-verification:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})