/**
 * Edge function: create-member
 *
 * Creates a new auth user and a corresponding Members row. Intended for admin use only.
 * Caller must be authenticated (e.g. admin); the function uses SUPABASE_SERVICE_ROLE_KEY
 * to create the auth user and insert into Members.
 *
 * Body: {
 *   firstName: string
 *   lastName: string
 *   email: string
 *   password: string
 *   phone?: string
 *   title?: string
 *   street?: string
 *   street2?: string
 *   city?: string
 *   state?: string
 *   postalCode?: string
 *   country?: string
 *   role?: string
 * }
 *
 * Returns: { userId: string, memberId: string }
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import {
  authenticateUser,
  isAdmin,
  createUnauthorizedResponse,
  createForbiddenResponse
} from '../_shared/auth.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Auth is done here because verify_jwt is disabled for this function (ES256 runtime bug)
  const authResult = await authenticateUser(req)
  if (authResult.error || !authResult.user) {
    return createUnauthorizedResponse(authResult.error ?? 'Authentication failed')
  }
  if (!isAdmin(authResult.user)) {
    return createForbiddenResponse('Admin only')
  }

  try {
    const body = await req.json() as {
      firstName?: string
      lastName?: string
      email?: string
      password?: string
      phone?: string
      title?: string
      street?: string
      street2?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
      role?: string
    }

    const { firstName, lastName, email, password } = body
    if (!firstName || !lastName || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'firstName, lastName, email and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Create auth user (trigger on auth.users will insert a Members row via handle_new_user)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { firstName: firstName.trim(), lastName: lastName.trim() }
    })

    if (authError) {
      console.error('Auth create user error:', authError)
      const authMsg = (authError.message || '').toLowerCase()
      const isDuplicateEmail =
        authMsg.includes('already registered') ||
        authMsg.includes('user already') ||
        (authMsg.includes('email') && (authMsg.includes('already') || authMsg.includes('exists') || authMsg.includes('duplicate')))
      const payload = isDuplicateEmail
        ? { errorCode: 'EMAIL_EXISTS', error: authError.message || 'Failed to create auth user' }
        : { error: authError.message || 'Failed to create auth user' }
      return new Response(JSON.stringify(payload), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = authData.user?.id
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Auth user created but no id returned' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const now = new Date().toISOString()

    // Trigger "handle_new_user" already inserted a Members row for this UserId. Use it and update.
    const { data: existingRows } = await supabase
      .from('Members')
      .select('Id')
      .eq('UserId', userId)
      .limit(1)

    const existingMember = existingRows?.[0]
    let memberId: string

    if (existingMember?.Id) {
      memberId = existingMember.Id
      const { error: updateError } = await supabase
        .from('Members')
        .update({
          FirstName: firstName.trim() || null,
          LastName: lastName.trim() || null,
          Email: email.trim() || null,
          Phone: body.phone?.trim() || null,
          Title: body.title?.trim() || null,
          Street: body.street?.trim() || null,
          Street2: body.street2?.trim() || null,
          City: body.city?.trim() || null,
          State: body.state?.trim() || null,
          PostalCode: body.postalCode?.trim() || null,
          Country: body.country?.trim() || null,
          Role: body.role?.trim() || 'user',
          LastModified: now,
          LastModifiedBy: null
        })
        .eq('Id', memberId)

      if (updateError) {
        console.error('Members update error:', updateError)
        await supabase.auth.admin.deleteUser(userId)
        return new Response(JSON.stringify({ error: updateError.message || 'Failed to update member record' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      // No row from trigger (e.g. trigger disabled); insert as before.
      memberId = crypto.randomUUID()
      const { error: insertError } = await supabase
        .from('Members')
        .insert({
          Id: memberId,
          UserId: userId,
          FirstName: firstName.trim() || null,
          LastName: lastName.trim() || null,
          Email: email.trim() || null,
          Phone: body.phone?.trim() || null,
          Title: body.title?.trim() || null,
          Street: body.street?.trim() || null,
          Street2: body.street2?.trim() || null,
          City: body.city?.trim() || null,
          State: body.state?.trim() || null,
          PostalCode: body.postalCode?.trim() || null,
          Country: body.country?.trim() || null,
          Role: body.role?.trim() || 'user',
          IsDeleted: false,
          Created: now,
          CreatedBy: null,
          LastModified: now,
          LastModifiedBy: null
        })

      if (insertError) {
        console.error('Members insert error:', insertError)
        await supabase.auth.admin.deleteUser(userId)
        const insertMsg = (insertError.message || '').toLowerCase()
        const isDuplicatePhone =
          insertError.code === '23505' ||
          (insertMsg.includes('phone') && (insertMsg.includes('unique') || insertMsg.includes('duplicate')))
        const payload = isDuplicatePhone
          ? { errorCode: 'PHONE_EXISTS', error: insertError.message || 'Failed to create member record' }
          : { error: insertError.message || 'Failed to create member record' }
        return new Response(JSON.stringify(payload), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(
      JSON.stringify({ userId, memberId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('create-member error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
