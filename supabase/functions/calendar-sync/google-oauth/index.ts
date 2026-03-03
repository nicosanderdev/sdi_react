import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../../../_shared/cors.ts'
import { authenticateUser, hasPropertyAccess } from '../../../_shared/auth.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Google OAuth configuration
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI') || `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendar-sync/google-oauth/callback`
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY') || 'default_key_change_in_prod'

interface OAuthTokens {
  access_token: string
  refresh_token?: string
  expires_at: number
  token_type: string
}

interface GoogleOAuthResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope?: string
}

interface InitiateOAuthRequest {
  propertyId: string
  calendarId?: string
  calendarName?: string
}

interface OAuthCallbackRequest {
  code: string
  state: string // Contains propertyId and other metadata
}

interface RefreshTokenRequest {
  integrationId: string
}

/**
 * Generate Google OAuth authorization URL
 */
function generateAuthUrl(propertyId: string, calendarId?: string, calendarName?: string): string {
  const baseUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events'
  ]

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline', // Request refresh token
    prompt: 'consent', // Force consent screen to get refresh token
    state: JSON.stringify({ propertyId, calendarId, calendarName })
  })

  return `${baseUrl}?${params.toString()}`
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
  const tokenUrl = 'https://oauth2.googleapis.com/token'

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: GOOGLE_REDIRECT_URI,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  const data: GoogleOAuthResponse = await response.json()

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in * 1000),
    token_type: data.token_type
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const tokenUrl = 'https://oauth2.googleapis.com/token'

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token refresh failed: ${error}`)
  }

  const data: GoogleOAuthResponse = await response.json()

  return {
    access_token: data.access_token,
    refresh_token: refreshToken, // Keep the same refresh token
    expires_at: Date.now() + (data.expires_in * 1000),
    token_type: data.token_type
  }
}

/**
 * Encrypt OAuth tokens for storage
 */
function encryptTokens(tokens: OAuthTokens): string {
  const tokenString = JSON.stringify(tokens)
  // Simple base64 encoding for now - in production, use proper encryption
  return btoa(tokenString)
}

/**
 * Decrypt OAuth tokens from storage
 */
function decryptTokens(encryptedTokens: string): OAuthTokens {
  try {
    const tokenString = atob(encryptedTokens)
    return JSON.parse(tokenString)
  } catch (error) {
    throw new Error('Failed to decrypt tokens')
  }
}

/**
 * Store OAuth tokens in database
 */
async function storeTokens(propertyId: string, calendarId: string, calendarName: string, tokens: OAuthTokens) {
  const encryptedAccessToken = encryptTokens(tokens)

  // Check if integration already exists
  const { data: existingIntegration } = await supabase
    .from('CalendarIntegrations')
    .select('Id')
    .eq('EstatePropertyId', propertyId)
    .eq('PlatformType', 0) // Google Calendar
    .eq('ExternalCalendarId', calendarId)
    .eq('IsDeleted', false)
    .single()

  const integrationData = {
    EstatePropertyId: propertyId,
    PlatformType: 0, // Google Calendar
    ExternalCalendarId: calendarId,
    ExternalCalendarName: calendarName,
    AccessToken: encryptedAccessToken,
    RefreshToken: tokens.refresh_token ? encryptTokens({ ...tokens, access_token: tokens.refresh_token }) : null,
    TokenExpiresAt: new Date(tokens.expires_at).toISOString(),
    IsActive: true,
    LastSyncAt: new Date().toISOString(),
    SyncStatus: 0, // Idle
    LastModified: new Date().toISOString()
  }

  if (existingIntegration) {
    // Update existing integration
    const { error } = await supabase
      .from('CalendarIntegrations')
      .update(integrationData)
      .eq('Id', existingIntegration.Id)

    if (error) throw error
    return existingIntegration.Id
  } else {
    // Create new integration
    const { data, error } = await supabase
      .from('CalendarIntegrations')
      .insert(integrationData)
      .select('Id')
      .single()

    if (error) throw error
    return data.Id
  }
}

/**
 * Get and refresh tokens if needed
 */
async function getValidTokens(integrationId: string): Promise<OAuthTokens> {
  const { data: integration, error } = await supabase
    .from('CalendarIntegrations')
    .select('AccessToken, RefreshToken, TokenExpiresAt')
    .eq('Id', integrationId)
    .eq('IsDeleted', false)
    .single()

  if (error || !integration) {
    throw new Error('Calendar integration not found')
  }

  let tokens = decryptTokens(integration.AccessToken)

  // Check if token is expired or will expire in next 5 minutes
  if (tokens.expires_at < (Date.now() + 5 * 60 * 1000)) {
    if (!integration.RefreshToken || !tokens.refresh_token) {
      throw new Error('Token expired and no refresh token available')
    }

    // Refresh the token
    const refreshToken = decryptTokens(integration.RefreshToken).access_token
    tokens = await refreshAccessToken(refreshToken)

    // Update stored tokens
    const encryptedAccessToken = encryptTokens(tokens)
    const { error: updateError } = await supabase
      .from('CalendarIntegrations')
      .update({
        AccessToken: encryptedAccessToken,
        TokenExpiresAt: new Date(tokens.expires_at).toISOString(),
        LastModified: new Date().toISOString()
      })
      .eq('Id', integrationId)

    if (updateError) {
      console.error('Failed to update refreshed tokens:', updateError)
    }
  }

  return tokens
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    switch (path) {
      case 'initiate': {
        // Initiate OAuth flow
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Authenticate user
        const authResult = await authenticateUser(req)
        if (!authResult.user) {
          return new Response(JSON.stringify({ error: authResult.error }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const body: InitiateOAuthRequest = await req.json()
        const { propertyId, calendarId, calendarName } = body

        // Verify user has access to property
        const hasAccess = await hasPropertyAccess(authResult.user, propertyId)
        if (!hasAccess) {
          return new Response(JSON.stringify({ error: 'Access denied' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const authUrl = generateAuthUrl(propertyId, calendarId, calendarName)

        return new Response(JSON.stringify({ authUrl }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'callback': {
        // Handle OAuth callback
        if (req.method !== 'GET') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const error = url.searchParams.get('error')

        if (error) {
          return new Response(JSON.stringify({ error: `OAuth error: ${error}` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (!code || !state) {
          return new Response(JSON.stringify({ error: 'Missing code or state parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Parse state to get property info
        let stateData
        try {
          stateData = JSON.parse(state)
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid state parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { propertyId, calendarId, calendarName } = stateData

        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code)

        // Store tokens and create/update integration
        const integrationId = await storeTokens(propertyId, calendarId || 'primary', calendarName || 'Primary Calendar', tokens)

        // Redirect to success page or return success response
        const successHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Calendar Connected</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .success { color: #28a745; }
              </style>
            </head>
            <body>
              <h1 class="success">✓ Calendar Connected Successfully!</h1>
              <p>Your Google Calendar has been connected and will sync automatically.</p>
              <p>You can close this window and return to the application.</p>
            </body>
          </html>
        `

        return new Response(successHtml, {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        })
      }

      case 'refresh': {
        // Refresh tokens for an existing integration
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Authenticate user
        const authResult = await authenticateUser(req)
        if (!authResult.user) {
          return new Response(JSON.stringify({ error: authResult.error }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const body: RefreshTokenRequest = await req.json()
        const { integrationId } = body

        // Verify user has access to the integration
        const { data: integration } = await supabase
          .from('CalendarIntegrations')
          .select('EstatePropertyId')
          .eq('Id', integrationId)
          .eq('IsDeleted', false)
          .single()

        if (!integration) {
          return new Response(JSON.stringify({ error: 'Integration not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const hasAccess = await hasPropertyAccess(authResult.user, integration.EstatePropertyId)
        if (!hasAccess) {
          return new Response(JSON.stringify({ error: 'Access denied' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Get valid tokens (will refresh if needed)
        const tokens = await getValidTokens(integrationId)

        return new Response(JSON.stringify({
          success: true,
          expires_at: tokens.expires_at
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown endpoint' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('Google OAuth function error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
