export interface ManageLinkEmail {
  subject: string;
  html: string;
}

export function buildManageLinkEmail(params: {
  reservationCode: string;
  manageUrl: string;
  propertyTitle?: string | null;
}): ManageLinkEmail {
  const reservationCode = params.reservationCode.trim();
  const propertyTitle = params.propertyTitle?.trim() || 'your booking';
  const subject = `Manage your booking ${reservationCode}`;
  const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <p>Use this link to manage, pay, or cancel <strong>${propertyTitle}</strong>.</p>
          <p>Reservation code: <strong>${reservationCode}</strong></p>
          <p style="margin: 24px 0;">
            <a href="${params.manageUrl}" style="display: inline-block; background: #E5C469; color: #0A1A2F; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Manage Your Booking</a>
          </p>
          <p>This link replaces any earlier manage link for this reservation. The reservation code is for viewing the booking and for reviews.</p>
        </body>
      </html>
    `;
  return { subject, html };
}

export type ManageLinkClientResult =
  | { status: 200; body: { success: true } }
  | { status: 429; body: { success: false; error: 'Too many requests' } }
  | { status: 500; body: { success: false; error: 'Internal server error' } };

/** Public response. Match, mismatch, and the new token stay off this body. */
export function manageLinkClientResult(input: {
  rateLimited: boolean;
  failed: boolean;
}): ManageLinkClientResult {
  if (input.failed) {
    return { status: 500, body: { success: false, error: 'Internal server error' } };
  }
  if (input.rateLimited) {
    return { status: 429, body: { success: false, error: 'Too many requests' } };
  }
  return { status: 200, body: { success: true } };
}
