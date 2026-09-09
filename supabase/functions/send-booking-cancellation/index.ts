import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildGuestManageUrl } from '../_shared/guestManageUrl.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  Notes: string | null;
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
        Notes,
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

    const booking = bookingData as unknown as BookingRow;

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
                <a href="${manageUrl}" class="button">View Booking Details</a>
              </p>`
      : '';

    const notesHtml = booking.Notes?.trim()
      ? `<p><strong>Note:</strong> ${booking.Notes.trim()}</p>`
      : '';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Cancelled - Holiday Trips</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #0A1A2F 0%, #4a5568 100%); color: white; padding: 40px 30px; text-align: center; }
            .content { padding: 40px 30px; }
            .booking-details { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #4a5568; }
            .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .footer { background: #f8f9fa; padding: 20px 30px; text-align: center; color: #666; font-size: 14px; }
            .button { display: inline-block; background: #E5C469; color: #0A1A2F; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            h1 { margin: 0; font-size: 28px; }
            h2 { color: #0A1A2F; margin-top: 30px; margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Booking Cancelled</h1>
              <p>Hi ${guestName}, your reservation has been cancelled</p>
            </div>

            <div class="content">
              <h2>Cancelled Booking Details</h2>

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
                  <span><strong>Guests:</strong></span>
                  <span>${booking.GuestCount}</span>
                </div>
              </div>

              ${notesHtml}
              ${manageLinkHtml}

              <p>If you believe this was a mistake or need help booking again, please contact us.</p>

              <p>Best regards,<br>The Holiday Trips Team</p>
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
    const subject = `Booking Cancelled: ${propertyTitle}`;

    if (!sendEmailsEnabled) {
      console.log('Dry-run booking cancellation email:', {
        mode: 'dry-run',
        from: fromEmail,
        to: [guestEmail],
        subject,
        htmlLength: emailHtml.length,
      });
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Cancellation email simulated (dry-run)',
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
      console.error('Failed to send cancellation email:', errorData);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send cancellation email' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    const emailResult = await emailResponse.json();
    console.log('Cancellation email sent successfully:', emailResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cancellation email sent successfully',
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
