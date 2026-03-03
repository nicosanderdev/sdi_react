import { corsHeaders } from '../_shared/cors.ts'

// dLocal Go API configuration
const DLOCAL_GO_API_KEY = Deno.env.get('DLOCAL_GO_API_KEY')!
const DLOCAL_GO_SECRET_KEY = Deno.env.get('DLOCAL_GO_SECRET_KEY')!
const DLOCAL_GO_ENV = Deno.env.get('DLOCAL_GO_ENV')

// Debug logging to verify environment variables
console.log('DLOCAL_GO_ENV:', DLOCAL_GO_ENV)
console.log('DLOCAL_GO_API_KEY loaded:', !!DLOCAL_GO_API_KEY)
console.log('DLOCAL_GO_API_KEY length:', DLOCAL_GO_API_KEY?.length)
console.log('DLOCAL_GO_SECRET_KEY loaded:', !!DLOCAL_GO_SECRET_KEY)
console.log('DLOCAL_GO_SECRET_KEY length:', DLOCAL_GO_SECRET_KEY?.length)

const BASE_URL = DLOCAL_GO_ENV === 'production'
  ? 'https://api.dlocalgo.com/v1'
  : 'https://api-sbx.dlocalgo.com/v1'

// Log the final BASE_URL after it's set
console.log('Final BASE_URL:', BASE_URL)

// Types for requests and responses
interface CreatePaymentRequest {
  amount: number
  currency: string
  orderId: string
  description?: string
  customerInfo: {
    name: string
    email: string
    phone?: string
    document?: string
  }
  callbackUrl?: string
}

interface GetPaymentStatusRequest {
  paymentId: string
}

interface RefundPaymentRequest {
  paymentId: string
  amount: number
  reason?: string
}

interface DLocalGoCreatePaymentRequest {
  amount: number
  currency: string
  country: string
  external_id: string
  notification_url?: string
  success_url?: string
  back_url?: string
  payer: {
    name: string
    email: string
    document?: string
  }
}

interface DLocalGoPaymentResponse {
  id: string
  amount: number
  currency: string
  status: string
  redirect_url?: string
  transaction_id?: string
  failure_reason?: string
  created_date: string
  approved_date?: string
}

interface CreatePaymentResponse {
  paymentId: string
  status: 'PENDING' | 'APPROVED' | 'DECLINED'
  redirectUrl?: string
  transactionDetails: {
    providerPaymentId: string
    providerTransactionId?: string
  }
}

interface GetPaymentStatusResponse {
  id: string
  amount: number
  currency: string
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'REFUNDED'
  orderId?: string
  customerInfo: {
    name?: string
    email?: string
    document?: string
  }
  transactionDetails: {
    providerPaymentId: string
    providerTransactionId?: string
    failureReason?: string
  }
  createdAt: string
  updatedAt: string
}

interface RefundPaymentResponse {
  refundId: string
  status: string
  amount: number
}

// Helper function to make dLocal Go API calls
async function makeDLocalGoRequest(endpoint: string, method: string = 'GET', body?: any) {
  const url = `${BASE_URL}${endpoint}`

  // Create Basic Auth header with API key and secret key
  const authString = `${DLOCAL_GO_API_KEY}:${DLOCAL_GO_SECRET_KEY}`
  const encodedAuth = btoa(authString)

  const headers = {
    'Authorization': `Basic ${encodedAuth}`,
    'Content-Type': 'application/json'
  }

  const options: RequestInit = {
    method,
    headers
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`dLocal Go API error (${response.status}):`, errorText)
    throw new Error(`dLocal Go API error: ${response.status} ${errorText}`)
  }

  return await response.json()
}

// Map dLocal Go status to our status
function mapDLocalGoStatus(dlocalStatus: string): 'PENDING' | 'APPROVED' | 'DECLINED' | 'REFUNDED' {
  switch (dlocalStatus.toLowerCase()) {
    case 'paid':
    case 'authorized':
    case 'completed':
      return 'APPROVED'
    case 'pending':
    case 'processing':
      return 'PENDING'
    case 'declined':
    case 'failed':
    case 'cancelled':
    case 'expired':
      return 'DECLINED'
    case 'refunded':
      return 'REFUNDED'
    default:
      return 'PENDING'
  }
}

// Create payment endpoint
async function createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
  // Transform to dLocal Go format
  const dlocalRequest: DLocalGoCreatePaymentRequest = {
    amount: request.amount,
    currency: request.currency,
    country: 'UY', // Default country, can be made configurable
    external_id: request.orderId,
    notification_url: request.callbackUrl,
    success_url: request.callbackUrl,
    back_url: request.callbackUrl,
    payer: {
      name: request.customerInfo.name,
      email: request.customerInfo.email,
      document: request.customerInfo.document
    }
  }

  const dlocalResponse: DLocalGoPaymentResponse = await makeDLocalGoRequest('/payments', 'POST', dlocalRequest)

  return {
    paymentId: dlocalResponse.id,
    status: mapDLocalGoStatus(dlocalResponse.status),
    redirectUrl: dlocalResponse.redirect_url,
    transactionDetails: {
      providerPaymentId: dlocalResponse.id,
      providerTransactionId: dlocalResponse.transaction_id
    }
  }
}

// Get payment status endpoint
async function getPaymentStatus(request: GetPaymentStatusRequest): Promise<GetPaymentStatusResponse> {
  const dlocalResponse: DLocalGoPaymentResponse = await makeDLocalGoRequest(`/payments/${request.paymentId}`)

  return {
    id: dlocalResponse.id,
    amount: dlocalResponse.amount,
    currency: dlocalResponse.currency,
    status: mapDLocalGoStatus(dlocalResponse.status),
    orderId: dlocalResponse.external_id,
    customerInfo: {
      name: dlocalResponse.payer?.name,
      email: dlocalResponse.payer?.email,
      document: dlocalResponse.payer?.document
    },
    transactionDetails: {
      providerPaymentId: dlocalResponse.id,
      providerTransactionId: dlocalResponse.transaction_id,
      failureReason: dlocalResponse.failure_reason
    },
    createdAt: dlocalResponse.created_date,
    updatedAt: dlocalResponse.approved_date || dlocalResponse.created_date
  }
}

// Refund payment endpoint (stub for now)
async function refundPayment(request: RefundPaymentRequest): Promise<RefundPaymentResponse> {
  // For now, return a placeholder response
  // In a real implementation, you'd call dLocal Go's refund endpoint
  console.log('Refund requested for payment:', request.paymentId, 'amount:', request.amount)

  return {
    refundId: `refund_${Date.now()}`,
    status: 'pending',
    amount: request.amount
  }
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
    const body = await req.json()
    const { action, ...actionData } = body

    // Validate action
    if (!action) {
      return new Response(JSON.stringify({ error: 'Missing action parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Route to appropriate handler
    let result
    switch (action) {
      case 'create':
        result = await createPayment(actionData as CreatePaymentRequest)
        break
      case 'status':
        result = await getPaymentStatus(actionData as GetPaymentStatusRequest)
        break
      case 'refund':
        result = await refundPayment(actionData as RefundPaymentRequest)
        break
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('dLocal payments function error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
