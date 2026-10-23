/**
 * Resolve guest manage-page base URL by listing type.
 * SummerRent → MAIN (casas), EventVenue → ALT (espacios).
 * RealEstate has no guest site yet — returns null (omit manage link).
 */
function getManageBaseUrl(listingType: string | null | undefined): string | null {
  const main = Deno.env.get('GUEST_BOOKING_MANAGE_BASE_URL_MAIN');
  const alt = Deno.env.get('GUEST_BOOKING_MANAGE_BASE_URL_ALT');
  const legacy = Deno.env.get('GUEST_BOOKING_MANAGE_BASE_URL');

  if (listingType === 'RealEstate') {
    return null;
  }

  const resolved =
    listingType === 'EventVenue'
      ? alt
      : listingType === 'SummerRent'
        ? main
        : main ?? legacy;

  return resolved ?? legacy ?? null;
}

/**
 * Origin of the guest site for Mercado Pago Checkout Pro back_urls.
 * Uses GUEST_BOOKING_MANAGE_BASE_URL_MAIN/ALT (or legacy) by listing type.
 */
export function getGuestPaymentReturnOrigin(
  listingType: string | null | undefined,
): string | null {
  const base = getManageBaseUrl(listingType);
  if (!base) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
}

/**
 * Checkout Pro back_url for the booked listing.
 * SummerRent → {casas origin}/property/{id}, EventVenue → {espacios origin}/venue/{id}.
 * Null when the listing has no guest site, the origin secret is missing, or the origin is not HTTPS.
 * Query is mpReturn=1 and bookingId only. Mercado Pago appends its own status and payment_id.
 */
export function buildGuestPaymentReturnUrl(
  listingType: string | null | undefined,
  propertyId: string | null | undefined,
  bookingId: string | null | undefined,
): string | null {
  const property = propertyId?.trim();
  const booking = bookingId?.trim();
  if (!property || !booking) return null;

  const path =
    listingType === 'EventVenue'
      ? `/venue/${encodeURIComponent(property)}`
      : listingType === 'SummerRent'
        ? `/property/${encodeURIComponent(property)}`
        : null;
  if (!path) return null;

  const origin = getGuestPaymentReturnOrigin(listingType);
  if (!origin) return null;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;

  const url = new URL(path, `${parsed.origin}/`);
  url.searchParams.set('mpReturn', '1');
  url.searchParams.set('bookingId', booking);
  return url.toString();
}

export function hasGuestManageBase(listingType: string | null | undefined): boolean {
  return getManageBaseUrl(listingType) != null;
}

export function buildGuestManageUrl(
  reservationCode: string | null | undefined,
  listingType: string | null | undefined
): string | null {
  const base = getManageBaseUrl(listingType);
  if (!base || !reservationCode) {
    return null;
  }

  const url = new URL(base);
  url.searchParams.set('code', reservationCode);
  if (listingType) {
    url.searchParams.set('listingType', listingType);
  }
  return url.toString();
}

/** Privileged manage link. Query is the opaque token only. */
export function buildGuestManageTokenUrl(
  token: string | null | undefined,
  listingType: string | null | undefined
): string | null {
  const base = getManageBaseUrl(listingType);
  const raw = token?.trim();
  if (!base || !raw) {
    return null;
  }

  const url = new URL(base);
  url.searchParams.delete('code');
  url.searchParams.delete('listingType');
  url.searchParams.set('token', raw);
  return url.toString();
}
