import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildGuestManageUrl } from '../_shared/guestManageUrl.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HostContact {
  name: string | null;
  email: string | null;
  phone: string | null;
}

interface GuestProfile {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface BookingRow {
  Id: string;
  GuestId: string | null;
  CheckInDate: string;
  CheckOutDate: string;
  GuestCount: number;
  TotalAmount: number | null;
  ReservationCode: string | null;
  ListingType: string | null;
  Status: number;
  EstatePropertyId: string;
  EstateProperties: {
    Title: string | null;
    StreetName: string | null;
    HouseNumber: string | null;
    Neighborhood: string | null;
    City: string | null;
    State: string | null;
  } | null;
}

function buildGuestName(profile: GuestProfile | null): string {
  if (!profile) return 'Guest';
  return [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || 'Guest';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const sendEmailsEnabled = Deno.env.get('SEND_EMAILS_ENABLED') === 'true';
    const { bookingId } = await req.json();

    if (!bookingId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Booking ID is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: bookingData, error: bookingError } = await supabase
      .from('Bookings')
      .select(`
        Id,
        GuestId,
        CheckInDate,
        CheckOutDate,
        GuestCount,
        TotalAmount,
        ReservationCode,
        ListingType,
        Status,
        EstatePropertyId,
        EstateProperties (
          Title,
          StreetName,
          HouseNumber,
          Neighborhood,
          City,
          State
        )
      `)
      .eq('Id', bookingId)
      .eq('IsDeleted', false)
      .single();

    if (bookingError || !bookingData) {
      console.error('Error fetching booking:', bookingError);
      return new Response(
        JSON.stringify({ success: false, error: 'Booking not found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    const booking = bookingData as BookingRow;

    let guestProfile: GuestProfile | null = null;
    if (booking.GuestId) {
      const { data: profileData, error: profileError } = await supabase.rpc(
        'resolve_guest_profile',
        { p_guest_id: booking.GuestId }
      );
      if (profileError) {
        console.error('Error resolving guest profile:', profileError);
      } else {
        guestProfile = (profileData as GuestProfile | null) ?? null;
      }
    }

    const guestEmail = guestProfile?.email?.trim() ?? '';
    if (!guestEmail) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'no_email',
          skipReason: 'no_email',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 422,
        }
      );
    }

    let host: HostContact = { name: null, email: null, phone: null };
    if (booking.Status === 1) {
      const { data: hostContact, error: hostError } = await supabase.rpc(
        'resolve_host_contact_for_property',
        { p_estate_property_id: booking.EstatePropertyId }
      );
      if (hostError) {
        console.error('Error resolving host contact:', hostError);
      } else if (hostContact) {
        host = {
          name: (hostContact as HostContact).name ?? null,
          email: (hostContact as HostContact).email ?? null,
          phone: (hostContact as HostContact).phone ?? null,
        };
      }
    }

    const property = booking.EstateProperties;
    const propertyTitle = property?.Title || 'Property';
    const reservationCode = booking.ReservationCode ?? booking.Id;
    const manageUrl = buildGuestManageUrl(booking.ReservationCode, booking.ListingType);
    const guestName = buildGuestName(guestProfile);

    const checkInDate = new Date(booking.CheckInDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const checkOutDate = new Date(booking.CheckOutDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const checkIn = new Date(booking.CheckInDate);
    const checkOut = new Date(booking.CheckOutDate);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    const totalAmount = booking.TotalAmount ?? 0;

    const locationParts = [
      property?.HouseNumber,
      property?.StreetName,
      property?.Neighborhood,
      property?.City,
      property?.State,
    ].filter(Boolean);
    const propertyLocation = locationParts.join(', ') || 'Location not specified';

    const manageLinkHtml = manageUrl
      ? `<p style="text-align: center; margin: 30px 0;">
                <a href="${manageUrl}" class="button">Manage Your Booking</a>
              </p>`
      : '';

    const hostContactHtml =
      booking.Status === 1 && (host.name || host.email || host.phone)
        ? `
              <h2>Host Contact</h2>
              <p>If you need to contact your host before your arrival:</p>
              <div class="booking-details">
                ${host.name ? `
                <div class="detail-row">
                  <span><strong>Name:</strong></span>
                  <span>${host.name}</span>
                </div>` : ''}
                ${host.email ? `
                <div class="detail-row">
                  <span><strong>Email:</strong></span>
                  <span>${host.email}</span>
                </div>` : ''}
                ${host.phone ? `
                <div class="detail-row">
                  <span><strong>Phone:</strong></span>
                  <span>${host.phone}</span>
                </div>` : ''}
              </div>`
        : '';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Confirmation - Holiday Trips</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #E5C469 0%, #0A1A2F 100%); color: white; padding: 40px 30px; text-align: center; }
            .content { padding: 40px 30px; }
            .booking-details { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #E5C469; }
            .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .total { font-weight: bold; font-size: 18px; color: #0A1A2F; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px; }
            .footer { background: #f8f9fa; padding: 20px 30px; text-align: center; color: #666; font-size: 14px; }
            .button { display: inline-block; background: #E5C469; color: #0A1A2F; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .highlight { color: #E5C469; font-weight: bold; }
            h1 { margin: 0; font-size: 28px; }
            h2 { color: #0A1A2F; margin-top: 30px; margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Booking Confirmed!</h1>
              <p>Hi ${guestName}, your reservation has been successfully confirmed</p>
            </div>

            <div class="content">
              <h2>Booking Details</h2>

              <div class="booking-details">
                <div class="detail-row">
                  <span><strong>Reservation code:</strong></span>
                  <span>${reservationCode}</span>
                </div>
                <div class="detail-row">
                  <span><strong>Property:</strong></span>
                  <span>${propertyTitle}</span>
                </div>
                <div class="detail-row">
                  <span><strong>Location:</strong></span>
                  <span>${propertyLocation}</span>
                </div>
                <div class="detail-row">
                  <span><strong>Check-in:</strong></span>
                  <span>${checkInDate}</span>
                </div>
                <div class="detail-row">
                  <span><strong>Check-out:</strong></span>
                  <span>${checkOutDate}</span>
                </div>
                <div class="detail-row">
                  <span><strong>Nights:</strong></span>
                  <span>${nights}</span>
                </div>
                <div class="detail-row">
                  <span><strong>Guests:</strong></span>
                  <span>${booking.GuestCount}</span>
                </div>
                <div class="detail-row total">
                  <span><strong>Total:</strong></span>
                  <span>$${totalAmount.toFixed(2)}</span>
                </div>
              </div>

              ${hostContactHtml}
              ${manageLinkHtml}

              <p>We hope you have an amazing stay! If you have any questions, please don't hesitate to contact us.</p>

              <p class="highlight">Safe travels,<br>The Holiday Trips Team</p>
            </div>

            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>Booking Reference: ${booking.Id}</p>
              <p>&copy; 2026 Holiday Trips. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const fromEmail = 'Holiday Trips <bookings@holidaytrips.com>';
    const subject = `Booking Confirmed: ${propertyTitle}`;

    if (!sendEmailsEnabled) {
      console.log('Dry-run booking confirmation email:', {
        mode: 'dry-run',
        from: fromEmail,
        to: [guestEmail],
        subject,
        htmlLength: emailHtml.length,
      });
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Confirmation email simulated (dry-run)',
          mode: 'dry-run',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [guestEmail],
        subject,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error('Failed to send email:', errorData);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send confirmation email' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    const emailResult = await emailResponse.json();
    console.log('Email sent successfully:', emailResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Confirmation email sent successfully',
        mode: 'live',
        emailId: emailResult.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
