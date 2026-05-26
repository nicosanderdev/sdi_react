/**
 * Sends flexible-billing invoice notification email to the billing subject
 * (member Email or company BillingEmail).
 *
 * POST { invoiceId: string }
 * Auth: admin JWT, or x-cron-secret matching INVOICE_EMAIL_CRON_SECRET (cron).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import {
  authenticateUser,
  createForbiddenResponse,
  createUnauthorizedResponse,
  isAdmin,
} from '../_shared/auth.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type InvoiceRow = {
  Id: string
  Total: number
  DueDate: string | null
  CreatedAt: string
  Status: string
  SubjectType: 'member' | 'company'
  MemberOrCompanyId: string
}

type UsageRow = {
  Id: string
  Type: string
  ReferenceId: string | null
  Amount: number | null
  CreatedAt: string
}

type BookingRow = {
  Id: string
  CheckInDate: string
  CheckOutDate: string
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isCronAuthorized(req: Request): boolean {
  const secret = Deno.env.get('INVOICE_EMAIL_CRON_SECRET')?.trim()
  if (secret) {
    const header = req.headers.get('x-cron-secret')?.trim()
    if (header === secret) return true
  }
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const token = auth.substring(7)
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  return !!serviceKey && token === serviceKey
}

function formatDateEs(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildInvoiceEmailHtml(params: {
  ownerName: string
  invoiceId: string
  amount: number
  dueDate: string | null
  createdAt: string
  itemCount: number
  lineItemsHtml: string
}): string {
  const shortId = params.invoiceId.slice(0, 8)
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.5; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a56db; font-size: 22px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 14px; }
    th { background: #f3f4f6; }
    .summary { background: #f9fafb; padding: 12px; border-radius: 8px; margin: 16px 0; }
    .footer { font-size: 12px; color: #6b7280; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Nueva factura pendiente de pago</h1>
    <p>Hola ${escapeHtml(params.ownerName)},</p>
    <p>Se ha generado una factura por los servicios de tu cuenta en Holiday Trips. Resumen:</p>
    <div class="summary">
      <p><strong>Referencia:</strong> ${escapeHtml(shortId)}</p>
      <p><strong>Fecha de emisión:</strong> ${escapeHtml(formatDateEs(params.createdAt))}</p>
      <p><strong>Fecha de vencimiento:</strong> ${escapeHtml(formatDateEs(params.dueDate))}</p>
      <p><strong>Importe total:</strong> ${escapeHtml(formatAmount(params.amount))}</p>
      <p><strong>Ítems:</strong> ${params.itemCount}</p>
    </div>
    ${params.lineItemsHtml}
    <p>El estado de la factura es <strong>pendiente de pago</strong>. Por favor, realiza el pago antes de la fecha de vencimiento para evitar interrupciones en tus publicaciones.</p>
    <p class="footer">Este es un correo automático. No respondas a este mensaje.<br/>ID de factura: ${escapeHtml(params.invoiceId)}</p>
  </div>
</body>
</html>`.trim()
}

function buildLineItemsTable(
  usageRows: UsageRow[],
  bookingsById: Map<string, BookingRow>
): string {
  if (usageRows.length === 0) {
    return '<p><em>Sin detalle de ítems.</em></p>'
  }

  const rows = usageRows
    .map((ur) => {
      const booking =
        ur.Type === 'booking' && ur.ReferenceId
          ? bookingsById.get(ur.ReferenceId)
          : undefined
      const dates =
        booking != null
          ? `${formatDateEs(booking.CheckInDate)} – ${formatDateEs(booking.CheckOutDate)}`
          : '—'
      const ref = ur.ReferenceId ? escapeHtml(ur.ReferenceId.slice(0, 8)) : '—'
      const amount = formatAmount(Number(ur.Amount ?? 0))
      const typeLabel = ur.Type === 'booking' ? 'Reserva' : escapeHtml(ur.Type)
      return `<tr><td>${typeLabel}</td><td>${ref}</td><td>${dates}</td><td>${amount}</td></tr>`
    })
    .join('')

  return `
<table>
  <thead>
    <tr><th>Tipo</th><th>Referencia</th><th>Fechas</th><th>Monto</th></tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`
}

async function resolveRecipient(
  subjectType: string,
  subjectId: string
): Promise<{ name: string; email: string }> {
  if (subjectType === 'member') {
    const { data, error } = await supabase
      .from('Members')
      .select('FirstName, LastName, Email')
      .eq('Id', subjectId)
      .eq('IsDeleted', false)
      .maybeSingle()

    if (error || !data) {
      return { name: 'Propietario', email: '' }
    }
    const name =
      [data.FirstName, data.LastName].filter(Boolean).join(' ').trim() || 'Propietario'
    return { name, email: (data.Email ?? '').trim() }
  }

  const { data, error } = await supabase
    .from('Companies')
    .select('Name, BillingEmail')
    .eq('Id', subjectId)
    .eq('IsDeleted', false)
    .maybeSingle()

  if (error || !data) {
    return { name: 'Propietario', email: '' }
  }
  return {
    name: (data.Name ?? 'Propietario').trim(),
    email: (data.BillingEmail ?? '').trim(),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const cronOk = isCronAuthorized(req)
  if (!cronOk) {
    const authResult = await authenticateUser(req)
    if (authResult.error || !authResult.user) {
      return createUnauthorizedResponse(authResult.error ?? 'Authentication failed')
    }
    if (!isAdmin(authResult.user)) {
      return createForbiddenResponse('Admin only')
    }
  }

  try {
    const body = (await req.json()) as { invoiceId?: string }
    const invoiceId = (body.invoiceId ?? '').trim()

    if (!invoiceId) {
      return jsonResponse({ error: 'invoiceId is required' }, 400)
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('Invoices')
      .select('Id, Total, DueDate, CreatedAt, Status, SubjectType, MemberOrCompanyId')
      .eq('Id', invoiceId)
      .maybeSingle()

    if (invoiceError) {
      console.error('Invoice fetch error:', invoiceError)
      return jsonResponse({ error: 'Failed to load invoice' }, 500)
    }

    if (!invoice) {
      return jsonResponse({ error: 'Invoice not found' }, 404)
    }

    const inv = invoice as InvoiceRow
    const recipient = await resolveRecipient(inv.SubjectType, inv.MemberOrCompanyId)

    if (!recipient.email) {
      return jsonResponse(
        { error: 'No billing email configured for invoice recipient' },
        422
      )
    }

    const { data: usageRows, error: usageError } = await supabase
      .from('UsageRecords')
      .select('Id, Type, ReferenceId, Amount, CreatedAt')
      .eq('InvoiceId', invoiceId)
      .order('CreatedAt', { ascending: true })

    if (usageError) {
      console.error('UsageRecords fetch error:', usageError)
      return jsonResponse({ error: 'Failed to load invoice items' }, 500)
    }

    const usages = (usageRows ?? []) as UsageRow[]
    const bookingIds = usages
      .filter((u) => u.Type === 'booking' && u.ReferenceId)
      .map((u) => u.ReferenceId as string)

    const bookingsById = new Map<string, BookingRow>()
    if (bookingIds.length > 0) {
      const { data: bookings, error: bookingsError } = await supabase
        .from('Bookings')
        .select('Id, CheckInDate, CheckOutDate')
        .in('Id', bookingIds)
        .eq('IsDeleted', false)

      if (bookingsError) {
        console.error('Bookings fetch error:', bookingsError)
      } else {
        for (const b of (bookings ?? []) as BookingRow[]) {
          bookingsById.set(b.Id, b)
        }
      }
    }

    const lineItemsHtml = buildLineItemsTable(usages, bookingsById)
    const html = buildInvoiceEmailHtml({
      ownerName: recipient.name,
      invoiceId: inv.Id,
      amount: Number(inv.Total ?? 0),
      dueDate: inv.DueDate,
      createdAt: inv.CreatedAt,
      itemCount: usages.length,
      lineItemsHtml,
    })

    const fromEmail =
      Deno.env.get('INVOICE_FROM_EMAIL') ?? 'Holiday Trips <billing@holidaytrips.com>'
    const subject = `Factura pendiente — ${formatAmount(Number(inv.Total ?? 0))} (ref. ${inv.Id.slice(0, 8)})`
    const sendEmailsEnabled = Deno.env.get('SEND_EMAILS_ENABLED') === 'true'

    if (!sendEmailsEnabled) {
      console.log('Dry-run flexible invoice email:', {
        mode: 'dry-run',
        from: fromEmail,
        to: [recipient.email],
        subject,
        html,
      })
      return jsonResponse({ success: true, mode: 'dry-run', invoiceId })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return jsonResponse({ error: 'RESEND_API_KEY is not configured' }, 500)
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient.email],
        subject,
        html,
      }),
    })

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text()
      console.error('Resend API error:', resendError)
      return jsonResponse({ error: 'Failed to send invoice email' }, 502)
    }

    const emailResult = await resendResponse.json()
    console.log('Flexible invoice email sent:', { invoiceId, emailId: emailResult.id })

    return jsonResponse({
      success: true,
      mode: 'live',
      invoiceId,
      emailId: emailResult.id,
    })
  } catch (error) {
    console.error('Unhandled send-flexible-invoice-email error:', error)
    return jsonResponse({ error: 'Unexpected error sending invoice email' }, 500)
  }
})
