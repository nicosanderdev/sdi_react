/**
 * Edge function: admin-update-user
 *
 * Admin only. Updates Members via RPC (uniqueness + is_admin) using the caller's JWT,
 * then syncs auth.users with the service role.
 *
 * Body: { memberId, firstName, lastName, email, phone? }
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import {
  authenticateUser,
  isAdmin,
  createUnauthorizedResponse,
  createForbiddenResponse,
} from '../_shared/auth.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type RpcResult = {
  success?: boolean
  message?: string
  field_errors?: { email?: string; phone?: string }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  const authResult = await authenticateUser(req)
  if (authResult.error || !authResult.user) {
    return createUnauthorizedResponse(authResult.error ?? 'Authentication failed')
  }
  if (!isAdmin(authResult.user)) {
    return createForbiddenResponse('Admin only')
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return createUnauthorizedResponse('Missing Authorization header')
  }

  try {
    const body = (await req.json()) as {
      memberId?: string
      firstName?: string
      lastName?: string
      email?: string
      phone?: string | null
    }

    const { memberId, firstName, lastName, email, phone } = body
    if (!memberId || !email?.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: 'memberId and email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: rpcRaw, error: rpcError } = await userClient.rpc('admin_update_member_contact', {
      p_member_id: memberId,
      p_first_name: firstName ?? '',
      p_last_name: lastName ?? '',
      p_email: email.trim(),
      p_phone: phone?.trim() ?? null,
    })

    if (rpcError) {
      console.error('admin_update_member_contact RPC error:', rpcError)
      return new Response(
        JSON.stringify({ success: false, message: rpcError.message || 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const rpcData = rpcRaw as RpcResult
    if (!rpcData?.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: rpcData?.message || 'Update rejected',
          fieldErrors: rpcData?.field_errors ?? undefined,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: memberRow, error: memberErr } = await serviceClient
      .from('Members')
      .select('UserId')
      .eq('Id', memberId)
      .single()

    if (memberErr || !memberRow?.UserId) {
      console.error('Member lookup after RPC:', memberErr)
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Member row updated but auth user could not be resolved',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const userId = memberRow.UserId as string
    const phoneVal = phone?.trim() || undefined

    const { error: authErr } = await serviceClient.auth.admin.updateUserById(userId, {
      email: email.trim(),
      phone: phoneVal,
      user_metadata: {
        firstName: (firstName ?? '').trim(),
        lastName: (lastName ?? '').trim(),
      },
      email_confirm: true,
    })

    if (authErr) {
      console.error('auth.admin.updateUserById error:', authErr)
      return new Response(
        JSON.stringify({
          success: false,
          message: `Profile saved in directory but auth sync failed: ${authErr.message}`,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify({ success: true, message: 'Updated' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('admin-update-user error:', err)
    return new Response(
      JSON.stringify({ success: false, message: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
