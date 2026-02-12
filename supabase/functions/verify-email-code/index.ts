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

    const { userId, code } = await req.json()

    if (!userId || !code) {
      return new Response(
        JSON.stringify({ error: 'User ID and verification code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find the verification code
    const { data: verificationData, error: fetchError } = await supabaseClient
      .from('verification_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('code', code)
      .eq('type', 'email_change')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchError || !verificationData) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired verification code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update the user's email in Supabase Auth
    const { error: updateError } = await supabaseClient.auth.updateUser({
      email: verificationData.email,
    })

    if (updateError) {
      console.error('Error updating user email:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update email address' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete the used verification code
    await supabaseClient
      .from('verification_codes')
      .delete()
      .eq('id', verificationData.id)

    return new Response(
      JSON.stringify({
        message: 'Email address updated successfully',
        newEmail: verificationData.email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in verify-email-code:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})