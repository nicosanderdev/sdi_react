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
