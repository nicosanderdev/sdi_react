/**
 * Edge function: admin-ban-user
 *
 * Admin only. Bans an auth user by id (e.g. after soft-delete on Members) so they cannot obtain new sessions.
 *
 * Body: { userId: string }
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
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/** Long ban (~100 years) as logical “disabled” when not deleting auth.users */
const BAN_DURATION = '876600h'

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

  const authResult = await authenticateUser(req)
  if (authResult.error || !authResult.user) {
    return createUnauthorizedResponse(authResult.error ?? 'Authentication failed')
  }
  if (!isAdmin(authResult.user)) {
    return createForbiddenResponse('Admin only')
  }

  try {
    const body = (await req.json()) as { userId?: string }
    const userId = body.userId?.trim()
    if (!userId) {
      return new Response(JSON.stringify({ success: false, message: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { error } = await serviceClient.auth.admin.updateUserById(userId, {
      ban_duration: BAN_DURATION,
    })

    if (error) {
      console.error('admin-ban-user updateUserById:', error)
      return new Response(
        JSON.stringify({ success: false, message: error.message || 'Failed to ban user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify({ success: true, message: 'User banned' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('admin-ban-user error:', err)
    return new Response(
      JSON.stringify({ success: false, message: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
