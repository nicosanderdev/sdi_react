import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BookingDetails {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  totalPrice: number;
  property: {
    title: string;
    streetName?: string;
    houseNumber?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    locationLatitude: number;
    locationLongitude: number;
  };
  user: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  host: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check if email sending is enabled
    const sendEmailsEnabled = Deno.env.get('SEND_EMAILS_ENABLED') === 'true';

    if (!sendEmailsEnabled) {
      console.log('Email sending is disabled');
      return new Response(
        JSON.stringify({ success: true, message: 'Email sending disabled' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Parse request body
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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch booking details with related data
    const { data: bookingData, error: bookingError } = await supabase
      .from('Bookings')
      .select(`
        Id,
        CheckInDate,
        CheckOutDate,
        NumberOfGuests,
        TotalPrice,
        EstateProperties (
          Title,
          StreetName,
          HouseNumber,
          Neighborhood,
          City,
          State,
          LocationLatitude,
          LocationLongitude,
          Owners:Members (
            FirstName,
            LastName,
            Email,
            Phone
          )
        ),
        Members (
          FirstName,
          LastName,
          Email
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

    // Transform data
    const booking: BookingDetails = {
      id: bookingData.Id,
      checkInDate: bookingData.CheckInDate,
      checkOutDate: bookingData.CheckOutDate,
      numberOfGuests: bookingData.NumberOfGuests,
      totalPrice: bookingData.TotalPrice,
      property: {
        title: bookingData.EstateProperties?.Title || 'Property',
        streetName: bookingData.EstateProperties?.StreetName,
        houseNumber: bookingData.EstateProperties?.HouseNumber,
        neighborhood: bookingData.EstateProperties?.Neighborhood,
        city: bookingData.EstateProperties?.City,
        state: bookingData.EstateProperties?.State,
        locationLatitude: bookingData.EstateProperties?.LocationLatitude || 0,
        locationLongitude: bookingData.EstateProperties?.LocationLongitude || 0,
      },
      user: {
        firstName: bookingData.Members?.FirstName,
        lastName: bookingData.Members?.LastName,
        email: bookingData.Members?.Email,
      },
      host: {
        firstName: bookingData.EstateProperties?.Owners?.FirstName,
        lastName: bookingData.EstateProperties?.Owners?.LastName,
        email: bookingData.EstateProperties?.Owners?.Email,
        phone: bookingData.EstateProperties?.Owners?.Phone,
      },
    };

    // Check if user has email
    if (!booking.user.email) {
      console.log('User has no email address');
      return new Response(
        JSON.stringify({ success: false, error: 'User has no email address' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Format dates
    const checkInDate = new Date(booking.checkInDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const checkOutDate = new Date(booking.checkOutDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Calculate number of nights
    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    // Format property location
    const locationParts = [
      booking.property.houseNumber,
      booking.property.streetName,
      booking.property.neighborhood,
      booking.property.city,
      booking.property.state,
    ].filter(Boolean);
    const propertyLocation = locationParts.join(', ') || 'Location not specified';

    // Create email HTML content
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
              <h1>🎉 Booking Confirmed!</h1>
              <p>Your reservation has been successfully confirmed</p>
            </div>

            <div class="content">
              <h2>Booking Details</h2>

              <div class="booking-details">
                <div class="detail-row">
                  <span><strong>Property:</strong></span>
                  <span>${booking.property.title}</span>
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
                  <span>${booking.numberOfGuests}</span>
                </div>
                <div class="detail-row total">
                  <span><strong>Total:</strong></span>
                  <span>$${booking.totalPrice.toFixed(2)}</span>
                </div>
              </div>

              <h2>Important Information</h2>
              <p>Thank you for choosing Holiday Trips! Here are some important details for your stay:</p>

              <ul>
                <li><strong>Check-in time:</strong> After 3:00 PM on your arrival date</li>
                <li><strong>Check-out time:</strong> Before 11:00 AM on your departure date</li>
                <li><strong>Access instructions:</strong> You will receive specific check-in instructions 24 hours before your arrival</li>
                <li><strong>Cancellation policy:</strong> Free cancellation up to 24 hours after booking. After that, cancellations made 7 days before check-in receive a 50% refund.</li>
              </ul>

              <h2>Host Contact</h2>
              <p>If you need to contact your host before your arrival:</p>
              <div class="booking-details">
                <div class="detail-row">
                  <span><strong>Name:</strong></span>
                  <span>${booking.host.firstName || ''} ${booking.host.lastName || ''}</span>
                </div>
                ${booking.host.email ? `
                <div class="detail-row">
                  <span><strong>Email:</strong></span>
                  <span>${booking.host.email}</span>
                </div>
                ` : ''}
                ${booking.host.phone ? `
                <div class="detail-row">
                  <span><strong>Phone:</strong></span>
                  <span>${booking.host.phone}</span>
                </div>
                ` : ''}
              </div>

              <p style="text-align: center; margin: 30px 0;">
                <a href="#" class="button">View Booking Details</a>
              </p>

              <p>We hope you have an amazing stay! If you have any questions, please don't hesitate to contact us.</p>

              <p class="highlight">Safe travels,<br>The Holiday Trips Team</p>
            </div>

            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>Booking Reference: ${booking.id}</p>
              <p>&copy; 2026 Holiday Trips. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email using Resend
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
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Holiday Trips <bookings@holidaytrips.com>',
        to: [booking.user.email],
        subject: `🎉 Booking Confirmed: ${booking.property.title}`,
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
        emailId: emailResult.id
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