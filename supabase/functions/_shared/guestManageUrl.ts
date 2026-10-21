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
