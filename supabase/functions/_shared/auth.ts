import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from './cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Create Supabase client with service role for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export interface AuthUser {
  id: string
  email: string
  role?: string
}

export interface AuthResult {
  user: AuthUser | null
  error: string | null
}

/**
 * Extract and validate JWT token from Authorization header
 */
export async function authenticateUser(request: Request): Promise<AuthResult> {
  try {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: 'Missing or invalid Authorization header' }
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    if (!token) {
      return { user: null, error: 'Empty token' }
    }

    // Get user from token
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return { user: null, error: 'Invalid token' }
    }

    // Get member info for role
    const { data: member } = await supabase
      .from('Members')
      .select('Role')
      .eq('UserId', user.id)
      .eq('IsDeleted', false)
      .single()

    const authUser: AuthUser = {
      id: user.id,
      email: user.email!,
      role: member?.Role
    }

    return { user: authUser, error: null }
  } catch (error) {
    console.error('Authentication error:', error)
    return { user: null, error: 'Authentication failed' }
  }
}

/**
 * Verify that the authenticated user owns the specified property
 */
export async function verifyPropertyOwnership(userId: string, propertyId: string): Promise<boolean> {
  try {
    // Use the is_property_owner helper function that checks through Owners table
    const { data, error } = await supabase
      .rpc('is_property_owner', {
        p_user_id: userId,
        p_property_id: propertyId
      })

    if (error) {
      console.error('Property ownership check error:', error)
      return false
    }

    return data === true
  } catch (error) {
    console.error('Property ownership verification error:', error)
    return false
  }
}

/**
 * Check if user is an admin
 */
export function isAdmin(user: AuthUser): boolean {
  return user.role === 'admin'
}

/**
 * Check if user has access to a property (owner or admin)
 */
export async function hasPropertyAccess(user: AuthUser, propertyId: string): Promise<boolean> {
  if (isAdmin(user)) {
    return true
  }

  return await verifyPropertyOwnership(user.id, propertyId)
}

/**
 * Create unauthorized response
 */
export function createUnauthorizedResponse(message = 'Unauthorized'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

/**
 * Create forbidden response
 */
export function createForbiddenResponse(message = 'Forbidden'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

/**
 * Create not found response
 */
export function createNotFoundResponse(message = 'Not found'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
